import { withSupabase } from "npm:@supabase/server@^1";
import { validate, isBot } from "./lib/validate.ts";
import {
  clientIp,
  corsHeaders,
  isTooLarge,
  parseBody,
  resolveOrigin,
} from "./lib/request.ts";

const SITE_HOST = "runbook.fyi";

/**
 * Public first-party analytics ingest.
 *
 * auth: 'none' - this is reachable by anyone, by design. The site's readers are
 * anonymous and the whole point is to measure them, so there is no credential
 * to require. What protects the table is that nothing unrecognised is stored:
 * the event name must be on an allowlist, the path is bounded and stripped of
 * query and fragment, props are bounded in count and length, and the referrer
 * is reduced to a host.
 *
 * cors: 'disabled' - handled here instead, so the origin allowlist is exact
 * rather than a wildcard.
 *
 * Every response is 204 with no body, including for rejected payloads. A
 * beacon cannot read the response and there is nothing useful to tell a
 * caller; distinguishing "stored" from "rejected" would only help someone
 * probing the allowlist.
 */
export default {
  fetch: withSupabase(
    { auth: "none", cors: "disabled" },
    async (req: Request, ctx: any) => {
      const origin = resolveOrigin(req.headers.get("Origin"));
      const headers = corsHeaders(origin);

      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }
      if (req.method !== "POST") {
        return new Response(null, { status: 405, headers });
      }
      // An origin we do not recognise gets nothing. Note this is a courtesy
      // rather than a security control: Origin is trivially forged by a
      // non-browser client. The real control is that only recognised payloads
      // are stored.
      if (origin === null) {
        return new Response(null, { status: 204 });
      }
      if (isTooLarge(req.headers.get("content-length"))) {
        return new Response(null, { status: 204, headers });
      }

      const body = parseBody(await req.text());
      if (body === null) {
        return new Response(null, { status: 204, headers });
      }

      const result = validate(body, SITE_HOST);
      if (!result.ok) {
        return new Response(null, { status: 204, headers });
      }
      const event = result.value;

      // The hash is derived inside the database so the salt never reaches this
      // runtime, where it could end up in a log line or an error trace.
      const { error } = await ctx.supabaseAdmin.rpc("analytics_record", {
        p_ip: clientIp(req.headers),
        p_ua: req.headers.get("user-agent") ?? "",
        p_event_name: event.eventName,
        p_page_path: event.pagePath,
        p_topic: event.topic,
        p_referrer_host: event.referrerHost,
        p_props: event.props,
        p_user_id: null,
        p_is_bot: isBot(req.headers.get("user-agent")),
      });

      if (error) {
        // Logged for us, invisible to the caller. A failed write must never
        // turn into a visible error on a reader's page.
        console.error("[collect] insert failed:", error.message);
      }

      return new Response(null, { status: 204, headers });
    },
  ),
};

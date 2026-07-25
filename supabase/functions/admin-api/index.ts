import { withSupabase } from "npm:@supabase/server@^1";
import { corsHeaders, resolveCorsOrigin } from "./lib/cors.ts";
import { parseRange } from "./lib/range.ts";
import { isFresh, selectPayload } from "./lib/cache.ts";
import { fetchGa4 } from "./lib/ga4.ts";
import { fetchProgress } from "./lib/progress.ts";
import { buildPayload } from "./lib/merge.ts";

/** Look the caller up in admin_users using the service-role client. */
async function isAdmin(
  supabaseAdmin: any,
  userId: string | undefined,
): Promise<boolean> {
  // Fail closed on a missing id. Passing undefined to .eq() serialises it as the
  // string "undefined", which Postgres rejects as an invalid uuid (22P02) and
  // turns a "not an admin" into a 500. Guard before the query.
  if (!userId) return false;
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// The Supabase Edge gateway runs before this handler. Verified against the
// deployed function with curl:
//   - OPTIONS preflight is answered by the gateway (204, Access-Control-Allow-
//     Origin: *), so a handler-level OPTIONS branch would be dead code.
//   - auth: "user" makes the gateway reject any request without a valid *user*
//     JWT (a missing token and a bare anon key both get 401 before we run), so
//     a handler-level "no userId" 401 branch would be dead code too.
// What is left to us is the two checks the gateway does not do: origin
// allowlisting (it returns a wildcard) and admin-membership.
export default {
  fetch: withSupabase({ auth: "user" }, async (req: Request, ctx: any) => {
    const origin = resolveCorsOrigin(req.headers.get("Origin"));
    if (origin === null) {
      return json({ error: "forbidden" }, 403, null);
    }

    // @supabase/server v1 exposes the caller's identity as ctx.userClaims with
    // shape { id, email, role } - the uuid is `id`, NOT `sub` (sub lives on the
    // full ctx.jwtClaims). The gateway guarantees a user JWT is present, but
    // isAdmin still fails closed if the id is ever missing.
    const userId = ctx.userClaims?.id;
    if (!(await isAdmin(ctx.supabaseAdmin, userId))) {
      return json({ error: "forbidden" }, 403, origin);
    }

    const url = new URL(req.url);
    const route = url.pathname.replace(/^\/admin-api\/?/, "");

    if (route === "health") {
      return json({ admin: true }, 200, origin);
    }

    if (route === "overview") {
      let range;
      try {
        range = parseRange(url.searchParams.get("range"));
      } catch {
        return json({ error: "invalid range" }, 400, origin);
      }

      const now = new Date();
      const cacheKey = `overview:${range.key}`;

      const { data: cached } = await ctx.supabaseAdmin
        .from("admin_metrics_cache")
        .select("payload, fetched_at")
        .eq("key", cacheKey)
        .maybeSingle();

      if (cached && isFresh(cached.fetched_at, now)) {
        return json({ ...cached.payload, stale: false, ageSeconds: 0 }, 200, origin);
      }

      const [ga4, progress] = await Promise.all([
        fetchGa4(range.days),
        fetchProgress(ctx.supabaseAdmin),
      ]);

      // Only cache a complete payload. A GA4 failure must not overwrite good
      // cached data with a half-empty result.
      const fresh = ga4 === null ? null : buildPayload(range.key, ga4, progress, now);
      if (fresh !== null) {
        await ctx.supabaseAdmin.from("admin_metrics_cache").upsert({
          key: cacheKey,
          payload: fresh,
          fetched_at: now.toISOString(),
        });
      }

      const chosen = selectPayload(cached ?? null, fresh, now);
      if (chosen.payload === null) {
        // No cache and GA4 down: still return the progress half.
        return json(
          { ...(buildPayload(range.key, null, progress, now) as object), stale: false, ageSeconds: null },
          200,
          origin,
        );
      }
      return json(
        { ...(chosen.payload as object), stale: chosen.stale, ageSeconds: chosen.ageSeconds },
        200,
        origin,
      );
    }

    return json({ error: "not found" }, 404, origin);
  }),
};

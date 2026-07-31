import { withSupabase } from "npm:@supabase/server@^1";
import { corsHeaders, resolveCorsOrigin } from "./lib/cors.ts";
import { buildFetch } from "./lib/compose.ts";
import { parseRange } from "./lib/range.ts";
import { isFresh, selectPayload } from "./lib/cache.ts";
import { fetchGa4 } from "./lib/ga4.ts";
import { fetchProgress } from "./lib/progress.ts";
import { fetchTraffic } from "./lib/traffic.ts";
import { buildPayload } from "./lib/merge.ts";
import { resolveRoute, routeNeedsGoTrue } from "./lib/routes.ts";
import { isUuid, parseUserQuery } from "./lib/identity.ts";
import { exportAccount, lookupAccount, resetProgress } from "./lib/accounts.ts";
import { grantAdmin, listAdmins, revokeAdmin } from "./lib/roster.ts";
import {
  buildGoTrueDeps,
  type GoTrueDeps,
  GoTrueConfigError,
} from "./lib/gotrue.ts";

// Built here, once, rather than inside the lib modules: reading Deno.env in a
// lib is what would make it untestable, and injecting fetch is what keeps the
// tests off the network.
//
// A missing env var is caught rather than thrown at module scope. Throwing
// during import takes the whole function down, including the routes that do not
// need GoTrue at all, and the resulting 500 carries no CORS headers. Held here,
// the misconfiguration is answered per request, in JSON, naming the variable.
let gotrue: GoTrueDeps | null = null;
let gotrueConfigError: string | null = null;
try {
  gotrue = buildGoTrueDeps(
    (k) => Deno.env.get(k),
    (...args) => globalThis.fetch(...args),
  );
} catch (e) {
  gotrueConfigError = (e as Error).message;
}

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
//
// The error floor goes OUTSIDE withSupabase, not inside it. That ordering lives
// in lib/compose.ts, where a test can hold it: see buildFetch below.
const handler = async (req: Request, ctx: any) => {
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
    const route = resolveRoute(req.method, url.pathname);
    if (route === null) return json({ error: "not found" }, 404, origin);

    // The routes that resolve an address through GoTrue cannot run without
    // those env vars. Answer them with the named problem rather than letting an
    // empty base url surface as "Invalid URL" four frames deeper. The gate
    // itself lives in lib/routes.ts, where a test can hold it to the route list.
    if (routeNeedsGoTrue(route) && gotrue === null) {
      return json({ error: gotrueConfigError ?? "admin-api is misconfigured" }, 500, origin);
    }

    // An accessor rather than `gotrue as GoTrueDeps`. The cast asserts the gate
    // above and the routes below can never disagree; if they ever do, it hands
    // null to a lib and the admin gets "Cannot read properties of null" with
    // nothing to act on. This throws the named configuration error instead, and
    // the call sites answer it as a 500 that says which variable is unset.
    const deps = (): GoTrueDeps => {
      if (gotrue === null) {
        throw new GoTrueConfigError(
          gotrueConfigError ?? "admin-api is misconfigured",
        );
      }
      return gotrue;
    };

    /** A configuration failure is a 500 with a readable body, never a throw. */
    const configFailure = (e: unknown): Response | null =>
      e instanceof GoTrueConfigError ? json({ error: e.message }, 500, origin) : null;

    // isAdmin() above already fails closed on a missing id, so reaching here
    // proves userId is a string. TypeScript cannot narrow through an awaited
    // call, so state it once here rather than asserting at four call sites.
    const actorId: string = userId as string;

    /** Parse ?email= / ?id= into one identifier, or answer 400. */
    const userQuery = () => parseUserQuery(
      url.searchParams.get("email"),
      url.searchParams.get("id"),
    );

    /** Read a JSON body, tolerating an empty or malformed one. */
    const body = async (): Promise<Record<string, unknown>> => {
      try {
        return (await req.json()) ?? {};
      } catch {
        return {};
      }
    };

    if (route === "health") {
      return json({ admin: true }, 200, origin);
    }

    // Deliberately uncached, unlike /overview. That one caches because GA4 is a
    // rate-limited third party whose failure has to survive as stale data; this
    // reads local Postgres in one query, so a cache would buy nothing and cost
    // the freshness that makes the panel worth looking at.
    if (route === "traffic") {
      let range;
      try {
        range = parseRange(url.searchParams.get("range"));
      } catch {
        return json({ error: "invalid range" }, 400, origin);
      }
      return json(await fetchTraffic(ctx.supabaseAdmin, range.days), 200, origin);
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

    if (route === "user") {
      try {
        const r = await lookupAccount(ctx.supabaseAdmin, deps(), userQuery());
        return json(r.body, r.status, origin);
      } catch (e) {
        if (e instanceof RangeError) return json({ error: e.message }, 400, origin);
        const misconfigured = configFailure(e);
        if (misconfigured) return misconfigured;
        throw e;
      }
    }

    if (route === "user.export") {
      try {
        const r = await exportAccount(ctx.supabaseAdmin, deps(), userQuery());
        return json(r.body, r.status, origin);
      } catch (e) {
        if (e instanceof RangeError) return json({ error: e.message }, 400, origin);
        const misconfigured = configFailure(e);
        if (misconfigured) return misconfigured;
        throw e;
      }
    }

    if (route === "user.reset") {
      const b = await body();
      const targetId = typeof b.userId === "string" ? b.userId : "";
      const confirmEmail = typeof b.confirmEmail === "string" ? b.confirmEmail : "";
      if (targetId === "" || confirmEmail === "") {
        return json({ error: "userId and confirmEmail are required" }, 400, origin);
      }
      // Shape-checked before it reaches GoTrue, which errors on a malformed
      // uuid. Malformed input is a 400, not a 500.
      if (!isUuid(targetId)) {
        return json({ error: "malformed user id" }, 400, origin);
      }
      const r = await resetProgress(ctx.supabaseAdmin, actorId, targetId, confirmEmail);
      return json(r.body, r.status, origin);
    }

    if (route === "admins.list") {
      return json({ admins: await listAdmins(ctx.supabaseAdmin) }, 200, origin);
    }

    if (route === "admins.grant") {
      const b = await body();
      const email = typeof b.email === "string" ? b.email : "";
      let parsed;
      try {
        parsed = parseUserQuery(email, null);
      } catch (e) {
        return json({ error: (e as Error).message }, 400, origin);
      }
      try {
        const r = await grantAdmin(
          ctx.supabaseAdmin,
          deps(),
          actorId,
          (parsed as { email: string }).email,
        );
        return json(r.body, r.status, origin);
      } catch (e) {
        const misconfigured = configFailure(e);
        if (misconfigured) return misconfigured;
        throw e;
      }
    }

    if (route === "admins.revoke") {
      const b = await body();
      const targetId = typeof b.userId === "string" ? b.userId : "";
      if (targetId === "") return json({ error: "userId is required" }, 400, origin);
      // Validated here rather than relying on the roster-membership check to
      // 404 first: that is an accident of ordering, not a guarantee.
      if (!isUuid(targetId)) {
        return json({ error: "malformed user id" }, 400, origin);
      }
      const r = await revokeAdmin(ctx.supabaseAdmin, actorId, targetId);
      return json(r.body, r.status, origin);
    }

    // Unreachable: resolveRoute only returns a RouteName covered by one of the
    // branches above, or null (handled immediately after the resolveRoute
    // call). TypeScript cannot see that exhaustiveness, so a terminal throw
    // satisfies the return-type check without duplicating the 404 response.
    throw new Error("unreachable route");
};

export default {
  fetch: buildFetch(withSupabase, { auth: "user" }, handler),
};

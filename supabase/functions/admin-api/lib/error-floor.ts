import { corsHeaders, resolveCorsOrigin } from "./cors.ts";

export type Handler = (req: Request, ctx: any) => Promise<Response>;

/**
 * Last-resort floor under every route.
 *
 * An uncaught throw is answered by the platform with a plain-text
 * `Internal Server Error` carrying NO CORS headers, so the browser cannot read
 * the body or tell it apart from a network failure - and the admin page then
 * guesses. Its guesses have been wrong in the worst direction, reporting a
 * completed delete as "nothing was deleted".
 *
 * Three routes had no try/catch at all, and any route added later would have
 * started out the same way. Wrapping the handler covers them all, including the
 * ones that do not exist yet. The per-route catches remain: they translate the
 * errors they recognise into a specific status. This catches only what nothing
 * else claimed.
 *
 * Lives here rather than inline in index.ts so it can be tested; index.ts is
 * the one module with no tests, which is exactly where an untested safety net
 * should not live.
 */
export function withErrorFloor(handler: Handler): Handler {
  return async (req: Request, ctx: any) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      // Logged in full, answered vaguely: the message can name internal schema.
      console.error("admin-api unhandled error", e);
      const origin = resolveCorsOrigin(req.headers.get("Origin"));
      return new Response(JSON.stringify({ error: "internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
  };
}

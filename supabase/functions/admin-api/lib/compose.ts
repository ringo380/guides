import { type Handler, withErrorFloor } from "./error-floor.ts";

/** The route handler withSupabase calls, once it has built the context. */
export type RouteHandler = (req: Request, ctx: any) => Promise<Response>;

/** withSupabase's shape: takes options and a handler, returns a fetch handler. */
export type ServerWrapper = (
  options: unknown,
  handler: RouteHandler,
) => (req: Request) => Promise<Response> | Response;

/**
 * Compose the routes with their wrappers, error floor OUTSIDE.
 *
 * The ordering is the whole point, and index.ts cannot prove it: applied
 * inside, the floor never sees what withSupabase itself throws before the
 * handler runs - client construction against a rotated service-role key, an
 * unexpected claims shape - and those escape as the platform's plain-text,
 * CORS-less 500 that the admin page then mis-narrates as a connection failure.
 * The first version of that fix had exactly this bug with every test passing,
 * because nothing exercised the composition.
 *
 * Extracted here so a test can throw from the WRAPPER rather than from the
 * handler and still demand a CORS-bearing JSON 500. Re-nesting the two in
 * index.ts is then a change to one line of glue that this function owns.
 *
 * A wrapper that throws while being CONSTRUCTED is out of scope: that happens
 * at module import, before any request exists to answer.
 */
export function buildFetch(
  withSupabaseImpl: ServerWrapper,
  options: unknown,
  handler: RouteHandler,
): Handler {
  const routes = withSupabaseImpl(options, handler);
  // withSupabase hands back a one-argument handler, so the floor is adapted to
  // that shape rather than the two-argument one it wraps elsewhere.
  return withErrorFloor(async (req: Request) => await routes(req));
}

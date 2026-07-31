export type RouteName =
  | "health"
  | "overview"
  | "traffic"
  | "user"
  | "user.export"
  | "user.reset"
  | "admins.list"
  | "admins.grant"
  | "admins.revoke";

/**
 * Exact (method, path) table. A Map keyed by "METHOD path" rather than nested
 * object lookup, so inherited keys such as "constructor" cannot resolve.
 *
 * Method is part of the key rather than checked afterwards: it makes a GET
 * reaching a write route impossible by construction instead of by an if.
 */
const TABLE = new Map<string, RouteName>([
  ["GET health", "health"],
  ["GET overview", "overview"],
  ["GET traffic", "traffic"],
  ["GET user", "user"],
  ["GET user/export", "user.export"],
  ["GET admins", "admins.list"],
  ["POST user/progress/reset", "user.reset"],
  ["POST admins", "admins.grant"],
  ["POST admins/revoke", "admins.revoke"],
]);

export function resolveRoute(
  method: string,
  pathname: string,
): RouteName | null {
  const route = pathname
    .replace(/^\/admin-api\/?/, "")
    .replace(/\/+$/, "");
  return TABLE.get(`${method.toUpperCase()} ${route}`) ?? null;
}

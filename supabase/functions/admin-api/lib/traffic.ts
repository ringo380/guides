export interface TrafficDay {
  day: string;
  visitors: number;
  pageviews: number;
  signedIn: number;
}

export interface TrafficPayload {
  from: string;
  to: string;
  days: number;
  daily: TrafficDay[];
  totals: {
    pageviews: number;
    visitorsPerDay: { avg: number; peak: number };
    daysWithTraffic: number;
  };
  topPages: Array<{ path: string; topic: string | null; views: number }>;
  topReferrers: Array<{ host: string; views: number }>;
  topEntryPages: Array<{ path: string; entries: number }>;
}

/**
 * Expand the sparse daily series into one entry per day in the window.
 *
 * The RPC omits days with no traffic rather than emitting zero rows, because in
 * the database a zero row and an absent row would be indistinguishable. A chart
 * needs the opposite: every day present, or a quiet Sunday silently shortens
 * the x-axis and the line joins Saturday straight to Monday, which reads as
 * continuous traffic that never dipped.
 *
 * Dates are handled as YYYY-MM-DD strings throughout. Parsing them into Date
 * objects to iterate would reintroduce a local-timezone shift on a series the
 * database already fixed to UTC.
 */
export function fillDays(
  daily: TrafficDay[],
  from: string,
  to: string,
): TrafficDay[] {
  const bySeen = new Map(daily.map((d) => [d.day, d]));
  const out: TrafficDay[] = [];

  // Iterate in UTC milliseconds. Date.UTC avoids the local offset that
  // `new Date("2026-07-01")` plus getDate() would introduce west of Greenwich.
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];

  const DAY_MS = 86_400_000;
  // Bounded independently of the arguments: a malformed pair that slipped the
  // checks above must not become an unbounded loop inside the request handler.
  const MAX_DAYS = 400;
  let count = 0;
  for (let t = start; t <= end && count < MAX_DAYS; t += DAY_MS, count++) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push(bySeen.get(day) ?? { day, visitors: 0, pageviews: 0, signedIn: 0 });
  }
  return out;
}

/**
 * Read the window aggregate.
 *
 * One RPC call rather than selecting the daily views over PostgREST: PostgREST
 * caps a response at max_rows and truncates silently, so summing a REST result
 * would produce a confidently wrong smaller number. The database does the
 * summation where nothing is capped.
 */
export async function fetchTraffic(
  supabaseAdmin: any,
  days: number,
  limit = 10,
): Promise<TrafficPayload> {
  const { data, error } = await supabaseAdmin.rpc("analytics_traffic", {
    p_days: days,
    p_limit: limit,
  });
  if (error) throw error;

  const payload = data as TrafficPayload;
  return { ...payload, daily: fillDays(payload.daily ?? [], payload.from, payload.to) };
}

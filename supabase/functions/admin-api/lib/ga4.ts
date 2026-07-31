export interface Ga4Section {
  activeUsers: number;
  sessions: number;
  topPages: Array<{ path: string; views: number }>;
  events: Record<string, number>;
  /**
   * The property that answered. An all-zero section used to be unattributable:
   * the first question anyone asks of it is "which property is this reading",
   * and the payload could not say. It is not a secret - this endpoint is
   * admin-only, and the id identifies a report source, not a credential.
   */
  propertyId: string;
  /**
   * Did the Data API return any rows at all?
   *
   * Zero rows is a successful answer, and the section it produces is identical
   * to the one a broken query would produce: every number zero, every list
   * empty, no error. Recording it separately is the only way the page can tell
   * "nobody was counted" from "nothing was asked properly" - which is exactly
   * what cost an afternoon of chasing credentials that were fine.
   */
  reported: boolean;
}

/**
 * Fold the three report responses into the section. Pure, so the shape this
 * produces - especially the empty one - is testable without a network.
 */
export function toSection(
  propertyId: string,
  totals: any,
  pages: any,
  events: any,
): Ga4Section {
  const row = totals?.rows?.[0]?.metricValues ?? [];
  const rowCount = (totals?.rows?.length ?? 0) + (pages?.rows?.length ?? 0) +
    (events?.rows?.length ?? 0);
  return {
    activeUsers: Number(row[0]?.value ?? 0),
    sessions: Number(row[1]?.value ?? 0),
    topPages: (pages?.rows ?? []).map((r: any) => ({
      path: r.dimensionValues[0].value,
      views: Number(r.metricValues[0].value),
    })),
    events: Object.fromEntries(
      (events?.rows ?? []).map((
        r: any,
      ) => [r.dimensionValues[0].value, Number(r.metricValues[0].value)]),
    ),
    propertyId,
    reported: rowCount > 0,
  };
}

/** Mint a Google OAuth access token from the service account via JWT bearer grant. */
async function accessToken(): Promise<string> {
  // Stored base64-encoded (GA4_SA_KEY_B64) so the multi-line JSON key survives
  // the secrets env-file without newline mangling.
  const raw = Deno.env.get("GA4_SA_KEY_B64");
  if (!raw) throw new Error("GA4_SA_KEY_B64 not set");
  const sa = JSON.parse(atob(raw));

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsigned = `${b64(header)}.${b64(claims)}`;

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sigB64}`,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  return (await res.json()).access_token;
}

async function runReport(
  token: string,
  property: string,
  body: unknown,
): Promise<any> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`runReport failed: ${res.status}`);
  return await res.json();
}

/**
 * Fetch the GA4 slice of the dashboard. Returns null on ANY failure so the
 * caller can fall back to stale cache instead of failing the whole request.
 */
export async function fetchGa4(days: number): Promise<Ga4Section | null> {
  try {
    const property = Deno.env.get("GA4_PROPERTY_ID") ?? "";
    const token = await accessToken();
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

    const [totals, pages, events] = await Promise.all([
      runReport(token, property, {
        dateRanges,
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      }),
      runReport(token, property, {
        dateRanges,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 20,
      }),
      runReport(token, property, {
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        limit: 50,
      }),
    ]);

    return toSection(property, totals, pages, events);
  } catch (e) {
    console.warn("[admin-api] GA4 fetch failed:", (e as Error).message);
    return null;
  }
}

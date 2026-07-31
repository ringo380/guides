/**
 * Assemble the dashboard payload. The three sections are labelled with their
 * population because they describe different groups and their numbers will
 * never agree.
 *
 * GA4's label used to read "all visitors", which is the one thing it is not:
 * the site gates the tag behind a cookie banner, so GA4 counts only readers who
 * accepted analytics cookies AND are not blocking googletagmanager. That label
 * is why an all-zero GA4 section read as a broken pipeline rather than as a
 * true statement about a small population - the section was answering a
 * narrower question than the one its own heading asked (#163).
 */
export const GA4_POPULATION =
  "readers who accepted analytics cookies and do not block the tag";
export function buildPayload(
  range: string,
  ga4: unknown | null,
  progress: unknown,
  now: Date,
): unknown {
  return {
    range,
    generatedAt: now.toISOString(),
    ga4: ga4 === null
      ? { population: GA4_POPULATION, error: "unavailable" }
      : { population: GA4_POPULATION, ...(ga4 as Record<string, unknown>) },
    progress: {
      population: "signed-in users only",
      ...(progress as Record<string, unknown>),
    },
  };
}

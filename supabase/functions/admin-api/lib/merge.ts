/**
 * Assemble the dashboard payload. The two sections are labelled with their
 * population because they describe different groups: GA4 covers all visitors,
 * progress covers only signed-in users. The same quiz appears in both and the
 * numbers will never agree.
 */
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
      ? { population: "all visitors", error: "unavailable" }
      : { population: "all visitors", ...(ga4 as Record<string, unknown>) },
    progress: {
      population: "signed-in users only",
      ...(progress as Record<string, unknown>),
    },
  };
}

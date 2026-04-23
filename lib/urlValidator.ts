

import { DataPoint } from "@/types";

const TIMEOUT_MS = 5000;

/** Returns true if URL responds with 2xx or 3xx */
async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OSINT-Intel-Bot/1.0)",
      },
    });
    // Accept 2xx and 3xx; reject 4xx/5xx
    return res.status < 400;
  } catch {
    // Network error, timeout, CORS — treat as unknown (keep it)
    return true;
  }
}

/**
 * Validates all sourceUrls in a list of DataPoints in parallel.
 * Points without a URL are kept as-is.
 * Points whose URL returns 4xx are marked urlValid=false.
 */
export async function validateDataPoints(points: DataPoint[]): Promise<DataPoint[]> {
  const withUrls = points.filter((p) => p.sourceUrl);
  const withoutUrls = points.filter((p) => !p.sourceUrl);

  // Check all URLs in parallel
  const checks = await Promise.allSettled(
    withUrls.map((p) => checkUrl(p.sourceUrl!))
  );

  const validated = withUrls.map((p, i) => ({
    ...p,
    urlValid: checks[i].status === "fulfilled" ? checks[i].value : true,
  }));

  // Filter out confirmed-dead links (urlValid=false)
  const alive = validated.filter((p) => p.urlValid !== false);

  return [...alive, ...withoutUrls];
}

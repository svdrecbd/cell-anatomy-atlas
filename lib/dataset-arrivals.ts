const internalHosts = new Set(["cellanatomy.org", "www.cellanatomy.org"]);
const automatedAgent = /bot|crawler|spider|slurp|headless|preview|curl|wget|python|go-http-client|uptime|monitor/i;

/** Classify a full dataset-page arrival without retaining request or visitor information. */
export function directDatasetIdentifier(request: Request, response: Response): string | null {
  const url = new URL(request.url);
  const match = /^\/datasets\/([a-z0-9][a-z0-9-]{0,127})\/?$/.exec(url.pathname);
  if (url.hostname !== "cellanatomy.org" || !match || request.method !== "GET" || response.status !== 200 ||
      !response.headers.get("Content-Type")?.toLowerCase().includes("text/html")) return null;
  if (request.headers.get("RSC") === "1" || request.headers.get("Next-Router-Prefetch") === "1" ||
      /prefetch/i.test(`${request.headers.get("Purpose") ?? ""} ${request.headers.get("Sec-Purpose") ?? ""}`)) return null;
  const destination = request.headers.get("Sec-Fetch-Dest");
  if (destination && destination !== "document") return null;
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") return null;
  const botManagement = request.cf?.botManagement;
  const verifiedBot = typeof botManagement === "object" && botManagement !== null &&
    "verifiedBot" in botManagement && botManagement.verifiedBot === true;
  if (verifiedBot || automatedAgent.test(request.headers.get("User-Agent") ?? "")) return null;
  const referrer = request.headers.get("Referer");
  if (referrer) {
    try {
      if (internalHosts.has(new URL(referrer).hostname)) return null;
    } catch {
      return null;
    }
  }
  return match[1];
}

export function recordDatasetArrival(
  request: Request,
  response: Response,
  database: D1Database | undefined,
  executionContext: ExecutionContext
): void {
  const datasetIdentifier = directDatasetIdentifier(request, response);
  if (!datasetIdentifier || !database) return;
  // One aggregate row per dataset and UTC date. Counting must never interrupt page delivery.
  const update = async () => {
    try {
      await database.prepare(`INSERT INTO dataset_direct_arrivals (dataset_id, arrival_date, arrivals)
        VALUES (?, date('now'), 1)
        ON CONFLICT(dataset_id, arrival_date) DO UPDATE SET arrivals = arrivals + 1`)
        .bind(datasetIdentifier).run();
    } catch {
      console.warn(JSON.stringify({ event: "dataset_arrival_count_unavailable" }));
    }
  };
  executionContext.waitUntil(update());
}

import vinext from "vinext/server/fetch-handler";
import { correctLegacyCorpusParameters } from "./lib/corpus-parameters";
import { isFilteredResultsUrl } from "./lib/search-metadata";
import { isPrivateResourcePath, permittedRequestMethods, purgeExpiredSignupCounters } from "./lib/request-security";
import { recordDatasetArrival } from "./lib/dataset-arrivals";

const canonicalHost = "cellanatomy.org";

const securityHeaders = {
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const correctedParameters = url.pathname === "/corpus" ? correctLegacyCorpusParameters(url.searchParams) : null;
    const requiresHttps = url.protocol === "http:" && [canonicalHost, `www.${canonicalHost}`].includes(url.hostname);
    if (requiresHttps || url.hostname === `www.${canonicalHost}` || correctedParameters) {
      if (requiresHttps) url.protocol = "https:";
      if (url.hostname === `www.${canonicalHost}`) url.hostname = canonicalHost;
      if (correctedParameters) url.search = correctedParameters.toString();
      return new Response(null, {
        status: 308,
        headers: {
          ...securityHeaders,
          Location: url.toString(),
          ...(isFilteredResultsUrl(url) ? { "X-Robots-Tag": "noindex, follow" } : {})
        }
      });
    }

    if (isPrivateResourcePath(url.pathname)) {
      console.info(JSON.stringify({ event: "private_resource_request_rejected", method: request.method }));
      return new Response("Not found", { status: 404, headers: { ...securityHeaders, "Cache-Control": "no-store" } });
    }

    const permittedMethods = permittedRequestMethods(url.pathname);
    if (!permittedMethods.includes(request.method)) {
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...securityHeaders, "Cache-Control": "no-store", Allow: permittedMethods.join(", ") }
      });
    }

    const response = await vinext.fetch(request, env, context);
    const secured = new Response(response.body, response);
    for (const [name, value] of Object.entries(securityHeaders)) {
      secured.headers.set(name, value);
    }
    if (isFilteredResultsUrl(url)) secured.headers.set("X-Robots-Tag", "noindex, follow");
    recordDatasetArrival(request, secured, env.SIGNUPS_DB, context);
    return secured;
  },
  async scheduled(controller, env, context) {
    context.waitUntil(purgeExpiredSignupCounters(env.SIGNUPS_DB));
  }
} satisfies ExportedHandler<Cloudflare.Env>;

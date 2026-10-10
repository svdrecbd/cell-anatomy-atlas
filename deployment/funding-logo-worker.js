import baselineHandler from "./funding-baseline-handler.js";
import { stylesheet, assetVersion, emblemSvg, universityLogoBase64, legacyAssets } from "./funding-logo-assets.js";

const stylesheetPath = `/_site/funding-logos.${assetVersion}.css`;
const resources = new Map([
  [stylesheetPath, { content: stylesheet, contentType: "text/css; charset=utf-8" }],
  [`/_site/nih-emblem.${assetVersion}.svg`, { content: emblemSvg, contentType: "image/svg+xml" }],
  [`/_site/ucsf-logo.${assetVersion}.png`, { content: Uint8Array.from(atob(universityLogoBase64), character => character.charCodeAt(0)), contentType: "image/png" }],
  [`/_site/funding-acknowledgment.${legacyAssets.assetVersion}.css`, { content: legacyAssets.stylesheet, contentType: "text/css; charset=utf-8" }],
  [`/_site/nih-emblem.${legacyAssets.assetVersion}.png`, { content: Uint8Array.from(atob(legacyAssets.emblemBase64), character => character.charCodeAt(0)), contentType: "image/png" }]
]);
const resourceHeaders = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()"
};

export default {
  async fetch(request, environment, executionContext) {
    const url = new URL(request.url);
    if (url.hostname === "www.cellanatomy.org" || (url.protocol === "http:" && url.hostname === "cellanatomy.org")) {
      return baselineHandler.fetch(request, environment, executionContext);
    }
    const resource = resources.get(url.pathname);
    if (resource) {
      if (!["GET", "HEAD"].includes(request.method)) {
        return new Response("Method not allowed", { status: 405, headers: { ...resourceHeaders, Allow: "GET, HEAD", "Cache-Control": "no-store" } });
      }
      return new Response(request.method === "HEAD" ? null : resource.content, {
        headers: { ...resourceHeaders, "Content-Type": resource.contentType }
      });
    }
    const response = await baselineHandler.fetch(request, environment, executionContext);
    if (request.method !== "GET" || response.status !== 200 || !response.headers.get("Content-Type")?.includes("text/html")) return response;
    const transformed = new HTMLRewriter().on("head", {
      element(element) { element.append(`<link rel="stylesheet" href="${stylesheetPath}">`, { html: true }); }
    }).transform(response);
    transformed.headers.delete("Content-Length");
    transformed.headers.delete("ETag");
    return transformed;
  }
};

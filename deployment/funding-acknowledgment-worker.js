import baselineHandler from "./funding-baseline-handler.js";
import { stylesheet, assetVersion, emblemBase64 } from "./funding-acknowledgment-assets.js";

const stylesheetPath = `/_site/funding-acknowledgment.${assetVersion}.css`;
const emblemPath = `/_site/nih-emblem.${assetVersion}.png`;
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
    if (url.pathname === stylesheetPath || url.pathname === emblemPath) {
      if (!["GET", "HEAD"].includes(request.method)) {
        return new Response("Method not allowed", { status: 405, headers: { ...resourceHeaders, Allow: "GET, HEAD", "Cache-Control": "no-store" } });
      }
      const stylesheetRequested = url.pathname === stylesheetPath;
      const body = stylesheetRequested ? stylesheet : Uint8Array.from(atob(emblemBase64), character => character.charCodeAt(0));
      return new Response(request.method === "HEAD" ? null : body, {
        headers: { ...resourceHeaders, "Content-Type": stylesheetRequested ? "text/css; charset=utf-8" : "image/png" }
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

import baselineHandler from "./security-baseline-handler.js";
import { enforceSignupRateLimits, enforceSignupSubmissionBudget, isPrivateResourcePath, purgeExpiredSignupCounters, readBoundedJsonObject, RequestValidationError, validateSignupRequest } from "./security/request-protection.js";

const rejectionHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()"
};

export default {
  async fetch(request, environment, executionContext) {
    const url = new URL(request.url);
    if (isPrivateResourcePath(url.pathname)) {
      return new Response(request.method === "HEAD" ? null : "Not found", {
        status: 404, headers: { ...rejectionHeaders, "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    if (request.method === "POST" && url.pathname.replace(/\/+$/, "") === "/api/beta-signups") {
      try {
        validateSignupRequest(request);
        const payload = await readBoundedJsonObject(request, 8192);
        await enforceSignupRateLimits(request, payload, environment);
        await enforceSignupSubmissionBudget(payload, environment.SIGNUPS_DB);
        const headers = new Headers(request.headers);
        headers.delete("Content-Length");
        headers.delete("Transfer-Encoding");
        request = new Request(request, { headers, body: JSON.stringify(payload) });
      } catch (error) {
        if (error instanceof RequestValidationError) {
          return new Response(JSON.stringify({ detail: error.message }), {
            status: error.statusCode,
            headers: { ...rejectionHeaders, ...(error.statusCode === 429 ? { "Retry-After": "60" } : {}) }
          });
        }
        console.error(JSON.stringify({ event: "signup_protection_unavailable" }));
        return new Response(JSON.stringify({ detail: "The signup could not be saved. Retry later." }), {
          status: 503, headers: rejectionHeaders
        });
      }
    }
    return baselineHandler.fetch(request, environment, executionContext);
  },
  async scheduled(controller, environment, executionContext) {
    executionContext.waitUntil(purgeExpiredSignupCounters(environment.SIGNUPS_DB));
  }
};

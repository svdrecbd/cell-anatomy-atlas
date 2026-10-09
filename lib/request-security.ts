export class RequestValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "RequestValidationError";
    this.statusCode = statusCode;
  }
}

export function isPrivateResourcePath(pathname: string): boolean {
  let decodedPath = pathname;
  for (let decodingPass = 0; decodingPass < 2; decodingPass++) {
    try {
      decodedPath = decodeURIComponent(decodedPath);
    } catch {
      break;
    }
  }
  return decodedPath.replaceAll("\\", "/").split("/").some((segment) =>
    /^(?:\.git|\.ssh|\.aws|\.docker|\.git-credentials|\.npmrc|\.pypirc|\.netrc|@fs|@id|@vite)$|^\.env(?:$|[._~:\-])|^\.dev\.vars(?:$|[._~:\-])/i.test(segment)
  );
}

export function validateSignupRequest(request: Request): void {
  const origin = request.headers.get("Origin");
  if ((origin !== null && origin !== new URL(request.url).origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new RequestValidationError("Submit the form from this website.", 403);
  }
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new RequestValidationError("The signup request must contain JSON.", 415);
  }
}

async function digestRateLimitIdentifier(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function purgeExpiredSignupCounters(database: D1Database): Promise<void> {
  const oldestWindow = Math.floor(Date.now() / 60000) - 2;
  await database.prepare("DELETE FROM signup_submission_limits WHERE window_started_at < ?").bind(oldestWindow).run();
}

export async function enforceSignupSubmissionBudget(payload: Record<string, unknown>, database: D1Database): Promise<void> {
  const currentWindow = Math.floor(Date.now() / 60000);
  const admissionStatement = `INSERT INTO signup_submission_limits (scope_identifier, window_started_at, submissions)
    VALUES (?, ?, 1)
    ON CONFLICT (scope_identifier, window_started_at) DO UPDATE SET submissions = submissions + 1
    WHERE submissions < ? RETURNING submissions`;
  const [, overallAdmission] = await database.batch([
    database.prepare("DELETE FROM signup_submission_limits WHERE window_started_at < ?").bind(currentWindow - 2),
    database.prepare(admissionStatement).bind("signup-overall", currentWindow, 120)
  ]);
  if (overallAdmission.results.length === 0) throw new RequestValidationError("Too many submissions. Retry in a minute.", 429);
  if (typeof payload.email === "string" && payload.email.trim().length <= 254) {
    const emailIdentifier = "signup-email:" + await digestRateLimitIdentifier(payload.email.trim().toLowerCase());
    const emailAdmission = await database.prepare(admissionStatement).bind(emailIdentifier, currentWindow, 3).all();
    if (emailAdmission.results.length === 0) throw new RequestValidationError("Too many submissions. Retry in a minute.", 429);
  }
}

export async function enforceSignupRateLimits(
  request: Request,
  payload: Record<string, unknown>,
  environment: Pick<Cloudflare.Env, "SIGNUP_NETWORK_RATE_LIMITER" | "SIGNUP_EMAIL_RATE_LIMITER">
): Promise<void> {
  const networkIdentifier = request.headers.get("CF-Connecting-IP") ?? "unidentified";
  const networkKey = "signup-network:" + await digestRateLimitIdentifier(networkIdentifier);
  const networkLimit = await environment.SIGNUP_NETWORK_RATE_LIMITER.limit({ key: networkKey });
  if (!networkLimit.success) throw new RequestValidationError("Too many submissions. Retry in a minute.", 429);
  if (typeof payload.email === "string" && payload.email.trim().length <= 254) {
    const emailKey = "signup-email:" + await digestRateLimitIdentifier(payload.email.trim().toLowerCase());
    const emailLimit = await environment.SIGNUP_EMAIL_RATE_LIMITER.limit({ key: emailKey });
    if (!emailLimit.success) throw new RequestValidationError("Too many submissions. Retry in a minute.", 429);
  }
}

export function permittedRequestMethods(pathname: string): readonly string[] {
  return pathname.replace(/\/+$/, "") === "/api/beta-signups"
    ? ["GET", "HEAD", "POST"]
    : ["GET", "HEAD"];
}

export async function readBoundedJsonObject(
  request: Request,
  maximumBytes: number
): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new RequestValidationError("The signup payload is too large.", 413);
  }
  if (!request.body) throw new RequestValidationError("Invalid JSON payload.", 400);

  const bodyReader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let bodyText = "";
  try {
    while (true) {
      const { done, value } = await bodyReader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await bodyReader.cancel();
        throw new RequestValidationError("The signup payload is too large.", 413);
      }
      bodyText += decoder.decode(value, { stream: true });
    }
    bodyText += decoder.decode();
    const payload: unknown = JSON.parse(bodyText);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new RequestValidationError("The signup payload must be a JSON object.", 400);
    }
    return payload as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    await bodyReader.cancel().catch(() => undefined);
    throw new RequestValidationError("Invalid JSON payload.", 400);
  } finally {
    bodyReader.releaseLock();
  }
}

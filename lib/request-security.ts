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
    /^(?:\.git|\.ssh|\.git-credentials)$|^\.env(?:$|[._~:\-])|^\.dev\.vars(?:$|[._~:\-])/i.test(segment)
  );
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

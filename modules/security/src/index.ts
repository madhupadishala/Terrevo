export class RequestBodyError extends Error {
  constructor(readonly status: 400 | 413, message: string) {
    super(message);
  }
}

/** Returns a caller-supplied correlation ID only when it is safe to echo; otherwise creates one. */
export function resolveRequestId(value: string | null): string {
  const candidate = value?.trim() ?? "";
  return /^[A-Za-z0-9._-]{1,64}$/.test(candidate) ? candidate : crypto.randomUUID();
}

/** Applies API-safe response headers without changing the response body or status. */
export function hardenApiResponse(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-request-id", requestId);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("cross-origin-resource-policy", "same-site");
  headers.set("content-security-policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Parses one JSON object while enforcing the byte limit even when Content-Length is absent or false. */
export async function readBoundedJsonObject(
  request: Request,
  maxBytes = 8_192,
): Promise<Record<string, unknown>> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new RequestBodyError(413, "Request body too large");
    }
  }

  if (!request.body) throw new RequestBodyError(400, "Invalid JSON body");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError(413, "Request body too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, "Invalid JSON body");
  }

  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("not object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new RequestBodyError(400, "Invalid JSON body");
  }
}

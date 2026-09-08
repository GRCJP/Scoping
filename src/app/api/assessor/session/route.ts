import {
  ASSESSOR_COOKIE,
  assessorCookieOptions,
  configuredAssessorKey,
  decideAssessorSessionLogin,
  isLoopbackHostname,
} from "@/lib/assessor-auth";
import { jsonPii } from "@/lib/http";
import { clientKey, rateLimitAllow } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

/**
 * Sets or clears the HttpOnly assessor cookie. Does not accept `?key=`.
 */
export async function POST(req: Request) {
  if (!rateLimitAllow(`assessor-login:${clientKey(req.headers)}`, 20, 15 * 60 * 1000)) {
    return jsonPii({ error: "Too many attempts." }, { status: 429 });
  }

  const configured = configuredAssessorKey();
  const host = req.headers.get("host") ?? new URL(req.url).host;
  const loopback = isLoopbackHostname(host);

  const declared = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonPii({ error: "Payload too large." }, { status: 413 });
  }

  let body: unknown = null;
  let providedKey = "";
  if (configured) {
    try {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > MAX_BODY_BYTES) {
        return jsonPii({ error: "Payload too large." }, { status: 413 });
      }
      body = JSON.parse(new TextDecoder().decode(buf)) as unknown;
    } catch {
      return jsonPii({ error: "Invalid JSON." }, { status: 400 });
    }
    const provided = typeof body === "object" && body && !Array.isArray(body) ? (body as { key?: unknown }).key : "";
    providedKey = typeof provided === "string" ? provided.trim() : "";
  }

  const decision = decideAssessorSessionLogin({
    configuredKey: configured,
    providedKey,
    loopback,
  });
  if (!decision.ok) {
    return jsonPii({ error: decision.error }, { status: decision.status });
  }
  if (decision.open) {
    return jsonPii({ ok: true, open: true });
  }

  const url = new URL(req.url);
  const res = jsonPii({ ok: true });
  res.cookies.set(ASSESSOR_COOKIE, providedKey, assessorCookieOptions(url.protocol === "https:"));
  return res;
}

export async function DELETE(req: Request) {
  const res = jsonPii({ ok: true });
  res.cookies.set(ASSESSOR_COOKIE, "", {
    ...assessorCookieOptions(new URL(req.url).protocol === "https:"),
    maxAge: 0,
  });
  return res;
}

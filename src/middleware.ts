import { NextResponse, type NextRequest } from "next/server";
import {
  ASSESSOR_COOKIE,
  assessorCookieOptions,
  configuredAssessorKey,
  decideAssessorGate,
  isAssessorGatedPath,
  isAssessorPublicPath,
  isLoopbackHost,
  providedAssessorSecret,
} from "@/lib/assessor-auth";
import { applySecurityHeaders } from "@/lib/security-headers";

/**
 * Gate for everything an OSC must never reach:
 *   /assessor/*                  go/no-go, red flags, internal scope brief
 *   /drop/<id>/internal          00 Internal contents
 *   /api/submissions/*           raw submission rows
 *   /api/assessor/*              assessor APIs (eMASS xlsx, …)
 *
 * Public (not gated): /assessor/login and POST/DELETE /api/assessor/session.
 * The session handler returns 401 on a bad key. Do not 404 those here.
 *
 * Accepts the assessor secret from the x-prescope-assessor-key header or an
 * HttpOnly SameSite=Strict cookie. Query `?key=` is ignored.
 *
 * Fails CLOSED when PSC_ASSESSOR_KEY is empty, except on loopback Host
 * (127.0.0.1 / localhost / ::1) so `npm run dev` still works locally.
 *
 * Also stamps HSTS + CSP on every matched response so OpenNext/Workers
 * emit them even when next.config headers() is skipped.
 */

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

function withSecurityHeaders(res: NextResponse, pathname: string): NextResponse {
  applySecurityHeaders(res.headers, pathname);
  return res;
}

function deny(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const accept = req.headers.get("accept") ?? "";
  const isHtml = accept.includes("text/html");
  const isAssessorPage = /^\/assessor(?:\/|$)/.test(path) && !path.startsWith("/api/");
  if (isHtml && isAssessorPage && !isAssessorPublicPath(path)) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/assessor/login", req.url)), path);
  }
  return withSecurityHeaders(notFound(), path);
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (!isAssessorGatedPath(path)) {
    return withSecurityHeaders(NextResponse.next(), path);
  }

  const key = configuredAssessorKey();
  const provided = providedAssessorSecret(req);
  const decision = decideAssessorGate({
    configuredKey: key,
    provided: provided.value,
    loopback: isLoopbackHost(req),
  });

  if (decision === "deny") return deny(req);

  const res = NextResponse.next();
  if (decision === "allow" && provided.via === "header" && key) {
    res.cookies.set(ASSESSOR_COOKIE, provided.value, assessorCookieOptions(req.nextUrl.protocol === "https:"));
  }
  return withSecurityHeaders(res, path);
}

export const config = {
  matcher: [
    /*
     * Run on pages + APIs so HSTS/CSP land on the intake Worker.
     * Skip Next static assets only.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

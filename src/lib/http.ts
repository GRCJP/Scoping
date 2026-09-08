import { NextResponse } from "next/server";
import { PII_CACHE_HEADERS } from "./security-headers";

export function jsonPii(data: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: PII_CACHE_HEADERS,
  });
}

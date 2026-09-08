import { NextResponse } from "next/server";
import { readOverlayLogo } from "@/lib/load-brand";

export const dynamic = "force-dynamic";

/** Serves the active company-pack logo (disk, deploy overlay, ASSETS, or R2). Missing → 404. */
export async function GET() {
  const file = await readOverlayLogo();
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "no-store",
    },
  });
}

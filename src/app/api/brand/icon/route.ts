import { NextResponse } from "next/server";
import { readOverlayIcon } from "@/lib/load-brand";

export const dynamic = "force-dynamic";

/** Serves the active company-pack tab icon (disk, overlay, ASSETS, or R2). Missing → 404. */
export async function GET() {
  const file = await readOverlayIcon();
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "no-store",
    },
  });
}

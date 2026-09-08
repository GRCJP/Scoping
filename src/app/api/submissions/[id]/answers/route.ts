import { NextResponse } from "next/server";
import { isSubmissionId } from "@/lib/ids";
import { PII_CACHE_HEADERS } from "@/lib/security-headers";
import { getSubmission } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isSubmissionId(id)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: PII_CACHE_HEADERS });
  const s = getSubmission(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404, headers: PII_CACHE_HEADERS });
  const name =
    s.box.files.find((f) => f.folder === "01 Answers")?.name ?? "osc-discovery-answers.md";
  const safe = name.replace(/["\r\n]/g, "");
  return new NextResponse(s.answersMarkdown, {
    status: 200,
    headers: {
      ...PII_CACHE_HEADERS,
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}"`,
    },
  });
}

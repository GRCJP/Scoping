import { NextResponse } from "next/server";
import { readAssessorSubmissionJson } from "@/lib/submission-read";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = readAssessorSubmissionJson(id);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

import { jsonPii } from "@/lib/http";
import { isIsoDate, MAX_DATE_NOTE, MAX_DATES } from "@/lib/dates";
import { isSubmissionId } from "@/lib/ids";
import { getSubmission, putSubmission } from "@/lib/store";

export const dynamic = "force-dynamic";

function asDates(raw: unknown): string[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "dates must be an array." };
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return { error: "Each date must be a string." };
    const v = item.trim();
    if (!v) continue;
    if (v.length > 10 || !isIsoDate(v)) return { error: "Dates must be calendar-valid YYYY-MM-DD." };
    out.push(v);
    if (out.length > MAX_DATES) return { error: "At most three dates." };
  }
  return out;
}

async function saveDates(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isSubmissionId(id)) return jsonPii({ error: "Not found" }, { status: 404 });
  const s = getSubmission(id);
  if (!s) return jsonPii({ error: "Not found" }, { status: 404 });

  let body: { dates?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonPii({ error: "Invalid JSON" }, { status: 400 });
  }

  const dates = asDates(body.dates);
  if (!Array.isArray(dates)) return jsonPii({ error: dates.error }, { status: 400 });
  if (dates.length === 0) {
    return jsonPii({ error: "Send at least one date." }, { status: 400 });
  }

  if (body.note !== undefined && typeof body.note !== "string") {
    return jsonPii({ error: "note must be a string." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > MAX_DATE_NOTE) {
    return jsonPii({ error: "note is too long." }, { status: 400 });
  }

  const next = { ...s, preferredDates: { dates, note } };
  putSubmission(next);
  return jsonPii({ ok: true, preferredDates: next.preferredDates });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return saveDates(req, ctx);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return saveDates(req, ctx);
}

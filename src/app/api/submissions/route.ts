import { jsonPii } from "@/lib/http";
import { listSubmissions } from "@/lib/store";
import { contactName, orgName } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = listSubmissions().map((s) => ({
    id: s.id,
    name: s.name,
    legalname: orgName(s.answers),
    submittedon: s.submittedon,
    orchstatus: s.orchstatus,
    path: s.path,
    infodetermination: s.scope.infodetermination,
    submitter: contactName(s.answers),
  }));
  return jsonPii({ rows });
}

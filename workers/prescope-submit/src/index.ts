import { authorizeRequest } from "./auth.ts";
import { trim, type WorkerEnv } from "./env.ts";
import { bad, json } from "./http.ts";
import { handleSubmit } from "./submit.ts";

export { PrescopeFill } from "./prescope-fill.ts";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "GET" && (path === "/" || path === "/health")) {
      return json({ ok: true, service: "prescope-submit" });
    }

    if (request.method === "POST" && (path === "/submit" || path === "/api/submit")) {
      if (!authorizeRequest(request.headers, trim(env.PRESCOPE_SUBMIT_SECRET))) {
        return bad("Unauthorized.", 401);
      }
      return handleSubmit(request, env);
    }

    return bad("Not found.", 404);
  },
};

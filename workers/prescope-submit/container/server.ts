/**
 * Node fill sidecar. Same mapper as the Next app and the Worker node path.
 * Listen locally or in a Cloudflare Container. Never email filled bytes.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { FILL_BODY_MAX_BYTES, handleFillHttp } from "./handler.ts";

const PORT = Number(process.env.PORT || 8788);
const HOST = (process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";
const SECRET = (process.env.PRESCOPE_SUBMIT_SECRET || "").trim();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > FILL_BODY_MAX_BYTES) {
        reject(new Error("Payload too large."));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function nodeHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return headers;
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, private",
  });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  try {
    const body = req.method === "POST" ? await readBody(req) : "";
    const out = await handleFillHttp(req.method || "GET", url.pathname, nodeHeaders(req), body, SECRET);
    send(res, out.status, out.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fill failed.";
    send(res, message === "Payload too large." ? 413 : 500, { error: message });
  }
});

if (process.env.PRESCOPE_FILL_NO_LISTEN !== "1") {
  server.listen(PORT, HOST, () => {
    console.log(`prescope-fill listening on ${HOST}:${PORT}`);
  });
}

export { server };

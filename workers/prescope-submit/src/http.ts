const PII_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...PII_HEADERS,
    },
  });
}

export function bad(error: string, status = 400, field?: string): Response {
  return json(field ? { error, field } : { error }, status);
}

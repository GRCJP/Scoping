const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar-valid ISO date (YYYY-MM-DD). */
export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const MAX_DATE_NOTE = 500;
export const MAX_DATES = 3;

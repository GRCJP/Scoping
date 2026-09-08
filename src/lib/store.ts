import type { Submission } from "./types";

const DEDUPE_WINDOW_MS = 60_000;
export const MAX_STORE_SIZE = 250;

type FingerprintHit = { id: string; timestamp: number };

const g = globalThis as unknown as {
  __pscStore?: Map<string, Submission>;
  __pscFingerprints?: Map<string, FingerprintHit>;
};

if (!g.__pscStore) {
  g.__pscStore = new Map<string, Submission>();
}
if (!g.__pscFingerprints) {
  g.__pscFingerprints = new Map<string, FingerprintHit>();
}

export const store = g.__pscStore;
const fingerprints = g.__pscFingerprints;

export function findByFingerprint(fp: string): FingerprintHit | undefined {
  return fingerprints.get(fp);
}

export function listSubmissions(): Submission[] {
  return [...store.values()].sort(
    (a, b) => new Date(b.submittedon).getTime() - new Date(a.submittedon).getTime()
  );
}

export function getSubmission(id: string): Submission | undefined {
  return store.get(id);
}

export function storeIsFull(): boolean {
  return store.size >= MAX_STORE_SIZE;
}

/** Persist the submission and remember fingerprint + id + timestamp for duplicate POST lock. */
export function putSubmission(s: Submission, fingerprint?: string): boolean {
  if (!store.has(s.id) && storeIsFull()) return false;
  store.set(s.id, s);
  const fp = fingerprint || s.fingerprint;
  if (fp) {
    fingerprints.set(fp, { id: s.id, timestamp: Date.now() });
  }
  return true;
}

export function resetStoreForTests(): void {
  store.clear();
  fingerprints.clear();
}

export { DEDUPE_WINDOW_MS };

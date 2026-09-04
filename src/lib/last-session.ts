import type { SessionResult } from "@/domain/types";

/**
 * The session that just ended, held in memory for the length of the page's
 * life.
 *
 * Persistence can fail: a private window, a full quota, a browser with
 * IndexedDB switched off. Without this the user finishes a session and the
 * result page tells them it does not exist, which reads as "the app lost my
 * work and will not say why". The result page falls back to this so the
 * numbers are always shown, alongside an honest notice that they were not
 * saved.
 */
let last: SessionResult | null = null;

export function rememberLastSession(result: SessionResult): void {
  last = result;
}

export function getLastSession(id: string): SessionResult | null {
  return last && last.id === id ? last : null;
}

/** Test seam. */
export function clearLastSession(): void {
  last = null;
}

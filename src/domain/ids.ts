/** Stable, dependency-free id generation for persisted records. */
export function newId(prefix = "s"): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return `${prefix}_${c.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

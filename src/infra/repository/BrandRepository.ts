import type {
  ReadingProgress,
  SessionQuery,
  SessionResult,
  UserPreferences,
} from "@/domain/types";
import { mergeProgress, migrateProgress } from "./migrations";

/**
 * Storage contract. UI and domain code depend only on this interface; V1
 * ships an IndexedDB + localStorage implementation, a future Supabase
 * implementation must satisfy the same contract.
 */
export interface BrandRepository {
  getPreferences(): Promise<UserPreferences>;
  savePreferences(value: UserPreferences): Promise<void>;
  getProgress(key: string): Promise<ReadingProgress | null>;
  /** Every stored progress record. Needed to export; nothing else enumerates them. */
  listProgress(): Promise<ReadingProgress[]>;
  saveProgress(value: ReadingProgress): Promise<void>;
  deleteProgress(key: string): Promise<void>;
  addSession(value: SessionResult): Promise<void>;
  getSession(id: string): Promise<SessionResult | null>;
  listSessions(query?: SessionQuery): Promise<SessionResult[]>;
}

/**
 * The stored progress records, migrated and collapsed one per key (shared by
 * adapters).
 *
 * A record's key is recomputed from its own fields, so a record written under
 * an older key — the edition used to be part of it — comes back under the key
 * the app asks for today. Two such records for one work are merged rather than
 * one of them being picked, which is why every read goes through here rather
 * than through the store's own key.
 */
export function readProgressList(raw: readonly unknown[]): ReadingProgress[] {
  const migrated = raw
    .map((r) => migrateProgress(r))
    .filter((p): p is ReadingProgress => p !== null);
  return mergeProgress(migrated);
}

/** The one progress record for `key`, or null. */
export function readProgress(raw: readonly unknown[], key: string): ReadingProgress | null {
  return readProgressList(raw).find((p) => p.key === key) ?? null;
}

/**
 * The keys a store actually holds for `key` — the current one, plus any older
 * record that migrates onto it.
 *
 * Deleting only the current key would leave a legacy record behind, and the
 * next read would migrate it forward and resurrect progress the reader had
 * just finished off. `SessionView` deletes progress when a work is completed,
 * so that resurrection is the ordinary path, not an edge case.
 */
export function storedProgressKeys(raw: readonly unknown[], key: string): string[] {
  const keys: string[] = [];
  for (const record of raw) {
    const stored = (record as { key?: unknown } | null)?.key;
    if (typeof stored !== "string") continue;
    if (migrateProgress(record)?.key === key) keys.push(stored);
  }
  return keys;
}

/** Applies a SessionQuery to an in-memory list (shared by adapters). */
export function applySessionQuery(
  sessions: SessionResult[],
  query: SessionQuery = {},
): SessionResult[] {
  let out = sessions;
  if (query.gameModeId) out = out.filter((s) => s.gameModeId === query.gameModeId);
  if (query.workId) out = out.filter((s) => s.workId === query.workId);
  if (query.textFilterId) {
    out = out.filter((s) => s.textFilterId === query.textFilterId);
  }
  const newestFirst = query.newestFirst ?? true;
  out = [...out].sort((a, b) =>
    newestFirst
      ? b.startedAt.localeCompare(a.startedAt)
      : a.startedAt.localeCompare(b.startedAt),
  );
  if (query.limit !== undefined) out = out.slice(0, query.limit);
  return out;
}

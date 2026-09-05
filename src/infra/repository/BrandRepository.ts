import type {
  ReadingProgress,
  SessionQuery,
  SessionResult,
  UserPreferences,
} from "@/domain/types";

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

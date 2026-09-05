import type {
  ReadingProgress,
  SessionQuery,
  SessionResult,
  UserPreferences,
} from "@/domain/types";
import { applySessionQuery, type BrandRepository } from "./BrandRepository";
import { defaultPreferences, migrateSession } from "./migrations";

/** In-memory adapter for tests and server-side rendering fallbacks. */
export class MemoryRepository implements BrandRepository {
  private preferences: UserPreferences = defaultPreferences();
  private progress = new Map<string, ReadingProgress>();
  private sessions = new Map<string, SessionResult>();

  async getPreferences(): Promise<UserPreferences> {
    return { ...this.preferences };
  }
  async savePreferences(value: UserPreferences): Promise<void> {
    this.preferences = { ...value };
  }
  async getProgress(key: string): Promise<ReadingProgress | null> {
    const p = this.progress.get(key);
    return p ? { ...p, completedSegmentIds: [...p.completedSegmentIds] } : null;
  }
  async listProgress(): Promise<ReadingProgress[]> {
    return [...this.progress.values()].map((p) => ({
      ...p,
      completedSegmentIds: [...p.completedSegmentIds],
    }));
  }
  async saveProgress(value: ReadingProgress): Promise<void> {
    this.progress.set(value.key, { ...value });
  }
  async deleteProgress(key: string): Promise<void> {
    this.progress.delete(key);
  }
  async addSession(value: SessionResult): Promise<void> {
    this.sessions.set(value.id, { ...value });
  }
  // Migrating on read is part of the repository contract, not an IndexedDB
  // detail: a caller must never have to ask which adapter it is talking to
  // before trusting a record's shape. Tested in tests/infra/repository-contract.ts.
  async getSession(id: string): Promise<SessionResult | null> {
    const raw = this.sessions.get(id);
    return raw ? migrateSession(raw) : null;
  }
  async listSessions(query?: SessionQuery): Promise<SessionResult[]> {
    const valid = [...this.sessions.values()]
      .map((s) => migrateSession(s))
      .filter((s): s is SessionResult => s !== null);
    return applySessionQuery(valid, query);
  }
}

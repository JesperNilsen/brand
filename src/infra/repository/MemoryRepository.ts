import type {
  ReadingProgress,
  SessionQuery,
  SessionResult,
  UserPreferences,
} from "@/domain/types";
import { applySessionQuery, type BrandRepository } from "./BrandRepository";
import { defaultPreferences } from "./migrations";

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
  async saveProgress(value: ReadingProgress): Promise<void> {
    this.progress.set(value.key, { ...value });
  }
  async deleteProgress(key: string): Promise<void> {
    this.progress.delete(key);
  }
  async addSession(value: SessionResult): Promise<void> {
    this.sessions.set(value.id, { ...value });
  }
  async getSession(id: string): Promise<SessionResult | null> {
    return this.sessions.get(id) ?? null;
  }
  async listSessions(query?: SessionQuery): Promise<SessionResult[]> {
    return applySessionQuery([...this.sessions.values()], query);
  }
}

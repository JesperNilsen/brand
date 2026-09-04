import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  ReadingProgress,
  SessionQuery,
  SessionResult,
  UserPreferences,
} from "@/domain/types";
import type { PreferencesStore } from "../preferences/local-storage";
import { applySessionQuery, type BrandRepository } from "./BrandRepository";
import { migrateSession } from "./migrations";

export const DB_NAME = "brand";
export const DB_VERSION = 1;

interface BrandDb extends DBSchema {
  sessions: {
    key: string;
    value: SessionResult;
    indexes: { byStartedAt: string };
  };
  progress: {
    key: string;
    value: ReadingProgress;
  };
}

/**
 * IndexedDB for sessions and reading progress; preferences live in the
 * injected PreferencesStore (localStorage in the browser) so the theme can be
 * read synchronously before first paint.
 */
export class IndexedDbRepository implements BrandRepository {
  private dbPromise: Promise<IDBPDatabase<BrandDb>> | null = null;

  constructor(
    private readonly preferences: PreferencesStore,
    private readonly dbName: string = DB_NAME,
  ) {}

  private db(): Promise<IDBPDatabase<BrandDb>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<BrandDb>(this.dbName, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("sessions")) {
            const sessions = db.createObjectStore("sessions", { keyPath: "id" });
            sessions.createIndex("byStartedAt", "startedAt");
          }
          if (!db.objectStoreNames.contains("progress")) {
            db.createObjectStore("progress", { keyPath: "key" });
          }
        },
      });
    }
    return this.dbPromise;
  }

  async getPreferences(): Promise<UserPreferences> {
    return this.preferences.read();
  }

  async savePreferences(value: UserPreferences): Promise<void> {
    this.preferences.write(value);
  }

  async getProgress(key: string): Promise<ReadingProgress | null> {
    const db = await this.db();
    return (await db.get("progress", key)) ?? null;
  }

  async saveProgress(value: ReadingProgress): Promise<void> {
    const db = await this.db();
    await db.put("progress", value);
  }

  async deleteProgress(key: string): Promise<void> {
    const db = await this.db();
    await db.delete("progress", key);
  }

  async addSession(value: SessionResult): Promise<void> {
    const db = await this.db();
    await db.put("sessions", value);
  }

  async getSession(id: string): Promise<SessionResult | null> {
    const db = await this.db();
    const raw = await db.get("sessions", id);
    return raw ? migrateSession(raw) : null;
  }

  async listSessions(query?: SessionQuery): Promise<SessionResult[]> {
    const db = await this.db();
    const all = await db.getAll("sessions");
    const valid = all
      .map((s) => migrateSession(s))
      .filter((s): s is SessionResult => s !== null);
    return applySessionQuery(valid, query);
  }
}

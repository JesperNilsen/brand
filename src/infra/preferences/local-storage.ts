import type { UserPreferences } from "@/domain/types";
import { defaultPreferences, migratePreferences } from "../repository/migrations";

export const PREFERENCES_STORAGE_KEY = "brand.preferences";

/** Small synchronous store for preferences (theme must be readable before paint). */
export interface PreferencesStore {
  read(): UserPreferences;
  write(value: UserPreferences): void;
}

export class LocalStoragePreferences implements PreferencesStore {
  constructor(private readonly storage: Storage | null = getLocalStorage()) {}

  read(): UserPreferences {
    if (!this.storage) return defaultPreferences();
    try {
      const raw = this.storage.getItem(PREFERENCES_STORAGE_KEY);
      return migratePreferences(raw ? JSON.parse(raw) : null);
    } catch {
      return defaultPreferences();
    }
  }

  write(value: UserPreferences): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage full or blocked: preferences simply do not persist.
    }
  }
}

export class MemoryPreferences implements PreferencesStore {
  private value = defaultPreferences();
  read(): UserPreferences {
    return { ...this.value };
  }
  write(value: UserPreferences): void {
    this.value = { ...value };
  }
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

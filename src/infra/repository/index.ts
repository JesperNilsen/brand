import {
  LocalStoragePreferences,
  MemoryPreferences,
} from "../preferences/local-storage";
import type { BrandRepository } from "./BrandRepository";
import { IndexedDbRepository } from "./IndexedDbRepository";
import { MemoryRepository } from "./MemoryRepository";

export type { BrandRepository } from "./BrandRepository";
export { IndexedDbRepository } from "./IndexedDbRepository";
export { MemoryRepository } from "./MemoryRepository";
export { defaultPreferences } from "./migrations";

let instance: BrandRepository | null = null;

/**
 * Single repository for the running app. IndexedDB in the browser; an
 * in-memory fallback during server rendering or when IndexedDB is missing.
 */
export function getRepository(): BrandRepository {
  if (instance) return instance;
  if (typeof window !== "undefined" && "indexedDB" in window) {
    instance = new IndexedDbRepository(new LocalStoragePreferences());
  } else {
    instance = new MemoryRepository();
  }
  return instance;
}

/** Synchronous preferences access for pre-paint theme handling. */
export function getPreferencesStore() {
  return typeof window !== "undefined"
    ? new LocalStoragePreferences()
    : new MemoryPreferences();
}

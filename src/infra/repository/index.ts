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
let persistent = false;

/**
 * Single repository for the running app. IndexedDB in the browser; an
 * in-memory fallback during server rendering or when IndexedDB is missing.
 */
export function getRepository(): BrandRepository {
  if (instance) return instance;
  // Truthiness, not `"indexedDB" in window`: a browser that disables storage
  // can leave the property present but undefined, and the `in` check would
  // then hand back an adapter whose every call throws.
  if (typeof window !== "undefined" && window.indexedDB) {
    instance = new IndexedDbRepository(new LocalStoragePreferences());
    persistent = true;
  } else {
    instance = new MemoryRepository();
    persistent = false;
  }
  return instance;
}

/**
 * False when the app is running on the in-memory fallback, so nothing survives
 * a reload. Silently pretending to save is the failure the user cannot see, so
 * the interface says so instead.
 */
export function isPersistent(): boolean {
  getRepository();
  return persistent;
}

/** Synchronous preferences access for pre-paint theme handling. */
export function getPreferencesStore() {
  return typeof window !== "undefined"
    ? new LocalStoragePreferences()
    : new MemoryPreferences();
}

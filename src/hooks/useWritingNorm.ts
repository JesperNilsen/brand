"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_WRITING_LANGUAGE_ID,
  resolveSelection,
  type WritingLanguageId,
  type WritingNormSelection,
} from "@/domain/orthography";
import { getPreferencesStore } from "@/infra/repository";

/**
 * The reader's writing language and norm, read synchronously from the
 * preferences store the way the theme is, so the header and an open page
 * agree without a round trip through IndexedDB.
 *
 * The snapshot is a string because useSyncExternalStore compares snapshots by
 * identity: a fresh object per read would re-render forever.
 */
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): string {
  const p = getPreferencesStore().read();
  return JSON.stringify([p.writingLanguageId, p.orthographyByLanguage]);
}

const SERVER_SNAPSHOT = JSON.stringify([DEFAULT_WRITING_LANGUAGE_ID, {}]);

function getServerSnapshot(): string {
  return SERVER_SNAPSHOT;
}

export type WritingNorm = WritingNormSelection & {
  /** The norm each language is on — the remembered one, or its default. */
  remembered: Readonly<Record<string, string>>;
  /** Plain choice of a language: keeps that language's remembered norm. */
  chooseLanguage: (languageId: WritingLanguageId) => void;
  /** Choice of a norm: selects its language too, and remembers the norm. */
  chooseOrthography: (languageId: WritingLanguageId, orthographyId: string) => void;
};

export function useWritingNorm(): WritingNorm {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const { selection, remembered } = useMemo(() => {
    const [writingLanguageId, orthographyByLanguage] = JSON.parse(snapshot) as [
      string,
      Record<string, string>,
    ];
    return {
      selection: resolveSelection({ writingLanguageId, orthographyByLanguage }),
      remembered: orthographyByLanguage,
    };
  }, [snapshot]);

  const chooseLanguage = useCallback((languageId: WritingLanguageId) => {
    const store = getPreferencesStore();
    store.write({ ...store.read(), writingLanguageId: languageId });
    listeners.forEach((l) => l());
  }, []);

  const chooseOrthography = useCallback((languageId: WritingLanguageId, orthographyId: string) => {
    const store = getPreferencesStore();
    const prefs = store.read();
    store.write({
      ...prefs,
      writingLanguageId: languageId,
      orthographyByLanguage: { ...prefs.orthographyByLanguage, [languageId]: orthographyId },
    });
    listeners.forEach((l) => l());
  }, []);

  return { ...selection, remembered, chooseLanguage, chooseOrthography };
}

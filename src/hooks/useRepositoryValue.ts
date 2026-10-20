"use client";

import { useEffect, useState, type DependencyList } from "react";
import { getRepository, type BrandRepository } from "@/infra/repository";

type Options<T> = {
  /** Runs with each value the hook accepts, in the same update that stores it. */
  onValue?: (value: T) => void;
  /**
   * Runs when the read rejects while it is still current. Without it the
   * rejection is left unhandled, as the loaders this replaced left it.
   */
  onError?: (error: unknown) => void;
};

/**
 * One read from the repository, held in state: `null` until it lands.
 *
 * Every page that reads storage used to carry its own copy of this — an effect,
 * `getRepository()`, a local `alive` flag, `setState` — and each copy had to
 * remember the flag. Here it lives once: a result that arrives after unmount,
 * or after `deps` changed and a newer read started, is dropped, and so is its
 * `onValue` / `onError`.
 *
 * `load` may return `null` to skip the read for these deps. The value then
 * stays what it was, as an effect that returned early left its state alone;
 * nothing is reset when deps change either, so the old value shows until the
 * new one replaces it.
 */
export function useRepositoryValue<T>(
  load: (repo: BrandRepository) => Promise<T> | null,
  deps: DependencyList,
  { onValue, onError }: Options<T> = {},
): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    const pending = load(getRepository());
    if (!pending) return;
    let alive = true;
    pending.then(
      (v) => {
        if (!alive) return;
        setValue(() => v);
        onValue?.(v);
      },
      onError &&
        ((e: unknown) => {
          if (alive) onError(e);
        }),
    );
    return () => {
      alive = false;
    };
    // The deps are the caller's, and eslint checks them at the call site
    // (`additionalHooks`). `load` and the callbacks are read from the render
    // that started the read, as the inline effects read their closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

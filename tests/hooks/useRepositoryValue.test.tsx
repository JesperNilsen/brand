// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useEffect, useState, type DependencyList } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BrandRepository } from "@/infra/repository";
import { getRepository } from "@/infra/repository";
import { useRepositoryValue } from "@/hooks/useRepositoryValue";

const { repo } = vi.hoisted(() => ({ repo: { stub: "repository" } }));
vi.mock("@/infra/repository", () => ({ getRepository: () => repo }));

type Options<T> = { onValue?: (value: T) => void; onError?: (error: unknown) => void };
type Impl = <T>(
  load: (repo: BrandRepository) => Promise<T> | null,
  deps: DependencyList,
  options?: Options<T>,
) => T | null;

/**
 * The loader every page carried before T-06, minus its `alive` flag: the copy
 * that forgot its cleanup. It is the control — the battery below must fail on
 * it, or the battery proves nothing about the hook.
 */
function useCopyWithoutCleanup<T>(
  load: (repo: BrandRepository) => Promise<T> | null,
  deps: DependencyList,
  { onValue, onError }: Options<T> = {},
): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    const pending = load(getRepository());
    if (!pending) return;
    pending.then((v) => {
      setValue(() => v);
      onValue?.(v);
    }, onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Settle a read inside act, so whatever it sets has rendered before we look. */
async function settle(run: () => void, promise: Promise<unknown>) {
  await act(async () => {
    run();
    await promise.catch(() => {});
  });
}

function battery(name: string, useImpl: Impl, test: typeof it | typeof it.fails) {
  describe(name, () => {
    test("drops a result that lands after unmount", async () => {
      const read = deferred<string>();
      const onValue = vi.fn();
      const { unmount } = renderHook(() => useImpl(() => read.promise, [], { onValue }));
      unmount();
      await settle(() => read.resolve("late"), read.promise);
      expect(onValue).not.toHaveBeenCalled();
    });

    test("drops a failure that lands after unmount", async () => {
      const read = deferred<string>();
      const onError = vi.fn();
      const { unmount } = renderHook(() => useImpl(() => read.promise, [], { onError }));
      unmount();
      await settle(() => read.reject(new Error("late")), read.promise);
      expect(onError).not.toHaveBeenCalled();
    });

    test("drops the older result when deps change before it lands", async () => {
      const reads = { a: deferred<string>(), b: deferred<string>() };
      const onValue = vi.fn();
      const { result, rerender } = renderHook(
        ({ key }: { key: "a" | "b" }) => useImpl(() => reads[key].promise, [key], { onValue }),
        { initialProps: { key: "a" as "a" | "b" } },
      );
      rerender({ key: "b" });
      await settle(() => reads.b.resolve("b"), reads.b.promise);
      expect(result.current).toBe("b");
      await settle(() => reads.a.resolve("a"), reads.a.promise);
      expect(result.current).toBe("b");
      expect(onValue).toHaveBeenCalledTimes(1);
    });
  });
}

battery("useRepositoryValue", useRepositoryValue, it);
battery("control: the inline loader without its alive flag", useCopyWithoutCleanup, it.fails);

describe("useRepositoryValue, the rest of the contract", () => {
  it("hands load the repository and holds null until the read lands", async () => {
    const read = deferred<number>();
    const load = vi.fn(() => read.promise);
    const { result } = renderHook(() => useRepositoryValue(load, []));
    expect(load).toHaveBeenCalledWith(repo);
    expect(result.current).toBeNull();
    await settle(() => read.resolve(7), read.promise);
    expect(result.current).toBe(7);
  });

  it("calls onValue once per accepted value and onError on a live failure", async () => {
    const ok = deferred<string>();
    const onValue = vi.fn();
    const first = renderHook(() => useRepositoryValue(() => ok.promise, [], { onValue }));
    await settle(() => ok.resolve("p"), ok.promise);
    expect(onValue).toHaveBeenCalledExactlyOnceWith("p");
    first.unmount();

    const bad = deferred<string>();
    const onError = vi.fn();
    const failure = new Error("read failed");
    const second = renderHook(() => useRepositoryValue(() => bad.promise, [], { onError }));
    await settle(() => bad.reject(failure), bad.promise);
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(second.result.current).toBeNull();
  });

  it("keeps the previous value when load skips, and still drops the read it superseded", async () => {
    const reads = [deferred<string>(), deferred<string>()];
    const { result, rerender } = renderHook(
      ({ step }: { step: number }) =>
        useRepositoryValue(() => (step === 2 ? null : reads[step].promise), [step]),
      { initialProps: { step: 0 } },
    );
    await settle(() => reads[0].resolve("first"), reads[0].promise);
    expect(result.current).toBe("first");
    rerender({ step: 1 });
    rerender({ step: 2 });
    await settle(() => reads[1].resolve("superseded"), reads[1].promise);
    expect(result.current).toBe("first");
  });
});

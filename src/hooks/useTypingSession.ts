"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionPlan } from "@/domain/modes/types";
import { bufferWasConsumed, primeInputBuffer } from "@/lib/input-buffer";
import {
  createRunner,
  runnerAbandon,
  runnerBackspace,
  runnerInsert,
  runnerPause,
  runnerRejectPaste,
  runnerResume,
  runnerStop,
  runnerTick,
  type RunnerState,
} from "@/domain/session/runner";

export type PasteNotice = { at: number } | null;

/**
 * Native DOM handlers (bound with addEventListener by the surface). React's
 * synthetic onBeforeInput does not expose `inputType`, so the surface binds
 * these directly to the textarea.
 */
export type TypingSessionHandlers = {
  onBeforeInput: (e: InputEvent) => void;
  onInput: (e: InputEvent) => void;
  onCompositionEnd: (e: CompositionEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onPaste: (e: ClipboardEvent) => void;
  onDrop: (e: DragEvent) => void;
};

export type UseTypingSessionOptions = {
  /** Called once when the runner reaches completed/abandoned. */
  onEnd?: (state: RunnerState) => void;
  /** Called when Escape asks for the session menu. */
  onRequestMenu?: () => void;
  /** Called whenever a segment is completed (Nonstop progress). */
  onSegmentComplete?: (state: RunnerState) => void;
  now?: () => number;
};

/**
 * Bridges browser input events to the pure SessionRunner. All text input
 * goes through `beforeinput` (with composition support) so Norwegian
 * characters and dead keys work regardless of keyboard layout. Paste and
 * drop are rejected. Backspace corrects; Tab and arrow keys are neutralised
 * while a session is active so they cannot move focus or the cursor.
 *
 * The hook is bound to one plan for its lifetime: mount the consuming
 * component with `key={plan.id}` to start over with a new plan.
 */
export function useTypingSession(
  plan: SessionPlan | null,
  options: UseTypingSessionOptions = {},
) {
  const now = options.now ?? Date.now;
  const [state, setState] = useState<RunnerState | null>(() =>
    plan ? createRunner(plan) : null,
  );
  const [clock, setClock] = useState<number>(() => now());
  const [pasteNotice, setPasteNotice] = useState<PasteNotice>(null);
  const endedRef = useRef(false);
  // Raised while `beforeinput` has an edit in hand, so that an `input` from
  // the same edit — which only arrives when preventDefault did not take, as
  // IME-driven changes are not always cancellable — is read as a restore and
  // not as a second edit. Lowered in a microtask rather than by the next
  // event: the `input` an edit produces is dispatched synchronously inside
  // the same task as its `beforeinput`, so it always sees the flag raised,
  // and an unrelated later event never does. Lowering it on the next `input`
  // instead would leave it raised whenever preventDefault succeeded and no
  // `input` ever came, and the next real edit would then be swallowed.
  const handledRef = useRef(false);
  const completedCountRef = useRef(0);
  const onEndRef = useRef(options.onEnd);
  const onSegmentRef = useRef(options.onSegmentComplete);
  const onMenuRef = useRef(options.onRequestMenu);
  useEffect(() => {
    onEndRef.current = options.onEnd;
    onSegmentRef.current = options.onSegmentComplete;
    onMenuRef.current = options.onRequestMenu;
  });

  const update = useCallback(
    (fn: (s: RunnerState, t: number) => RunnerState) => {
      const t = now();
      setClock(t);
      setState((s) => (s ? fn(s, t) : s));
    },
    [now],
  );

  // Live clock while active; also enforces the time limit.
  const active = state?.status === "active";
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => update(runnerTick), 100);
    return () => window.clearInterval(id);
  }, [active, update]);

  // Fire onEnd / onSegmentComplete exactly once per transition.
  useEffect(() => {
    if (!state) return;
    if (state.completedSegmentIds.length > completedCountRef.current) {
      completedCountRef.current = state.completedSegmentIds.length;
      onSegmentRef.current?.(state);
    }
    if (
      (state.status === "completed" || state.status === "abandoned") &&
      !endedRef.current
    ) {
      endedRef.current = true;
      onEndRef.current?.(state);
    }
  }, [state]);

  const insert = useCallback(
    (text: string) => update((s, t) => runnerInsert(s, text, t)),
    [update],
  );
  const backspace = useCallback(
    () => update((s, t) => runnerBackspace(s, t)),
    [update],
  );
  const rejectPaste = useCallback(() => {
    update((s, t) => runnerRejectPaste(s, t));
    setPasteNotice({ at: now() });
  }, [update, now]);
  const stop = useCallback(() => update((s, t) => runnerStop(s, t)), [update]);
  const pause = useCallback(() => update((s, t) => runnerPause(s, t)), [update]);
  const resume = useCallback(() => update((s, t) => runnerResume(s, t)), [update]);
  const abandon = useCallback(
    () => update((s, t) => runnerAbandon(s, t)),
    [update],
  );

  const handlers: TypingSessionHandlers = useMemo(
    () => ({
      onBeforeInput(e) {
        const type = e.inputType;
        if (type === "insertCompositionText") return; // handled on compositionend
        e.preventDefault();
        handledRef.current = true;
        queueMicrotask(() => {
          handledRef.current = false;
        });
        switch (type) {
          case "insertText":
            if (e.data) insert(e.data);
            break;
          case "insertLineBreak":
          case "insertParagraph":
            insert("\n");
            break;
          case "deleteContentBackward":
            backspace();
            break;
          case "insertFromPaste":
          case "insertFromPasteAsQuotation":
          case "insertFromDrop":
          case "insertFromYank":
            rejectPaste();
            break;
          default:
            break;
        }
      },
      // A soft keyboard deletes out of the field rather than sending a key,
      // so a delete can arrive with no `beforeinput` in front of it at all.
      // The buffer (see lib/input-buffer) is what makes such a delete
      // observable; this is where it is read and put back.
      onInput(e) {
        const target = e.target as HTMLTextAreaElement | null;
        // Composition writes into the field as it goes; `compositionend` owns
        // the commit and the restore.
        if (e.isComposing) return;
        if (!handledRef.current) {
          // Decided by the buffer shrinking as well as by `inputType`, to
          // cover keyboards that report a type we do not know. Insertions are
          // deliberately not read out of the field here: `beforeinput` and
          // `compositionend` already carry the ones a session accepts, and
          // inferring an insertion from the field's contents would be a way
          // for a rejected paste to get in through the back.
          const looksLikeDelete =
            e.inputType === "deleteContentBackward" ||
            (!e.inputType.startsWith("insert") && bufferWasConsumed(target));
          if (looksLikeDelete) backspace();
        }
        primeInputBuffer(target);
      },
      onCompositionEnd(e) {
        const data = e.data;
        const target = e.target as HTMLTextAreaElement | null;
        primeInputBuffer(target);
        if (data) insert(data);
      },
      onKeyDown(e) {
        if (e.key === "Tab" && active) e.preventDefault();
        if (
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "Home" ||
          e.key === "End"
        ) {
          e.preventDefault();
        }
        if (e.key === "Escape") {
          // Escape used to drop focus, which was a way out that never said so.
          // It now opens the session menu; the menu's own Escape closes it and
          // gives focus back.
          e.preventDefault();
          onMenuRef.current?.();
        }
      },
      onPaste(e) {
        e.preventDefault();
        rejectPaste();
      },
      onDrop(e) {
        e.preventDefault();
        rejectPaste();
      },
    }),
    [insert, backspace, rejectPaste, active],
  );

  // Hide the paste notice after a moment.
  useEffect(() => {
    if (!pasteNotice) return;
    const id = window.setTimeout(() => setPasteNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [pasteNotice]);

  return {
    state,
    clock,
    handlers,
    pasteNotice,
    stop,
    abandon,
    pause,
    resume,
    insert,
    backspace,
  };
}

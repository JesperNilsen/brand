"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionPlan } from "@/domain/modes/types";
import {
  createRunner,
  runnerAbandon,
  runnerBackspace,
  runnerInsert,
  runnerRejectPaste,
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
  onCompositionEnd: (e: CompositionEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onPaste: (e: ClipboardEvent) => void;
  onDrop: (e: DragEvent) => void;
};

export type UseTypingSessionOptions = {
  /** Called once when the runner reaches completed/abandoned. */
  onEnd?: (state: RunnerState) => void;
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
  const completedCountRef = useRef(0);
  const onEndRef = useRef(options.onEnd);
  const onSegmentRef = useRef(options.onSegmentComplete);
  useEffect(() => {
    onEndRef.current = options.onEnd;
    onSegmentRef.current = options.onSegmentComplete;
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
      onCompositionEnd(e) {
        const data = e.data;
        const target = e.target as HTMLTextAreaElement | null;
        if (target) target.value = "";
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
        if (e.key === "Escape") (e.target as HTMLElement | null)?.blur();
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

  return { state, clock, handlers, pasteNotice, stop, abandon, insert, backspace };
}

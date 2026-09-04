"use client";

import { useEffect, useRef } from "react";
import { deriveCharStates } from "@/domain/engine/render";
import type { TypingSessionState } from "@/domain/engine/engine";
import type { TypingSessionHandlers } from "@/hooks/useTypingSession";

type Props = {
  engine: TypingSessionState;
  handlers: TypingSessionHandlers;
  /** Shown faintly below the active text in continuous modes. */
  preview?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

/**
 * The reading surface: target text rendered character by character with
 * pending/correct/incorrect states and a quiet caret. Keystrokes go to a
 * visually hidden textarea overlaying the text.
 */
export function TypingSurface({ engine, handlers, preview, autoFocus, disabled }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const chars = deriveCharStates(engine);
  const cursor = engine.typedText.length;

  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, disabled, engine.targetText]);

  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursor]);

  // Native listeners: React's synthetic onBeforeInput lacks `inputType`.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const { onBeforeInput, onCompositionEnd, onKeyDown, onPaste, onDrop } = handlers;
    el.addEventListener("beforeinput", onBeforeInput);
    el.addEventListener("compositionend", onCompositionEnd);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("paste", onPaste);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("beforeinput", onBeforeInput);
      el.removeEventListener("compositionend", onCompositionEnd);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("paste", onPaste);
      el.removeEventListener("drop", onDrop);
    };
  }, [handlers]);

  const statusClass =
    engine.status === "active"
      ? "is-active"
      : engine.status === "idle"
        ? "is-idle"
        : "is-done";

  return (
    <div
      className={`typing-surface prose-measure ${statusClass}`}
      onClick={() => inputRef.current?.focus()}
      data-testid="typing-surface"
    >
      <p className="m-0" aria-hidden="true">
        {chars.map((c) => {
          const isCursor = c.index === cursor;
          const isNewline = c.char === "\n";
          const cls = [
            `ch-${c.state}`,
            isCursor ? "ch-cursor" : "",
            isNewline ? "ch-newline" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <span key={c.index} className={cls} ref={isCursor ? cursorRef : undefined}>
              {isNewline ? "\n" : c.char}
            </span>
          );
        })}
        {cursor >= chars.length && (
          <span className="ch-cursor" ref={cursorRef}>
            {"​"}
          </span>
        )}
      </p>
      {preview && (
        <p className="m-0 mt-8 text-ink-faint" aria-hidden="true">
          {preview}
        </p>
      )}
      <textarea
        ref={inputRef}
        className="typing-input"
        aria-label="Skrivefelt. Skriv teksten som vises."
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        data-testid="typing-input"
      />
    </div>
  );
}

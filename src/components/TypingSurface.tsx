"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { deriveCharStates } from "@/domain/engine/render";
import type { TypingSessionState } from "@/domain/engine/engine";
import type { TypingSessionHandlers } from "@/hooks/useTypingSession";

type Props = {
  engine: TypingSessionState;
  handlers: TypingSessionHandlers;
  /** Shown faintly after the active text in continuous modes. */
  preview?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Announced with the text, e.g. "Første akt, 1 — Oppe i sneen". */
  label?: string;
};

/** Lines of context kept above the active line. */
const LINES_ABOVE = 1;
/** Total lines visible in the viewport. */
const VISIBLE_LINES = 3;

/**
 * The reading surface: target text rendered character by character with
 * pending/correct/incorrect states and a quiet caret.
 *
 * The text scrolls under a steady active line rather than the line moving down
 * the page, so the eye stays in one place through a long passage. Keystrokes go
 * to a visually hidden textarea overlaying the text.
 */
export function TypingSurface({
  engine,
  handlers,
  preview,
  autoFocus,
  disabled,
  label,
}: Props) {
  const describedById = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const chars = deriveCharStates(engine);
  const cursor = engine.typedText.length;

  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, disabled, engine.targetText]);

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

  /** Scroll the text so the caret's line sits at a fixed height. */
  const align = useCallback(() => {
    const caret = cursorRef.current;
    const lines = linesRef.current;
    if (!caret || !lines) return;
    const lineHeight = parseFloat(getComputedStyle(lines).lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
    const caretTop = caret.offsetTop - lines.offsetTop;
    const next = Math.max(0, caretTop - LINES_ABOVE * lineHeight);
    setOffset(next);
  }, []);

  useLayoutEffect(align, [align, cursor, engine.targetText]);

  // Wrapping decides where the caret's line is, and wrapping changes for
  // reasons a window resize never reports: a containing layout changing width,
  // a font arriving after first paint, browser zoom. Any of those would leave
  // the text translated to obsolete line positions, with the caret drifting
  // out of the visible window.
  useEffect(() => {
    const lines = linesRef.current;
    if (!lines) return;
    const observer = new ResizeObserver(() => align());
    observer.observe(lines);
    const viewport = lines.parentElement;
    if (viewport) observer.observe(viewport);
    window.addEventListener("resize", align);
    let cancelled = false;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    void fonts?.ready.then(() => {
      if (!cancelled) align();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", align);
    };
  }, [align]);

  const statusClass =
    engine.status === "active"
      ? "is-active"
      : engine.status === "idle"
        ? "is-idle"
        : "is-done";

  return (
    <>
      {/*
        The rendered text is one span per character so it can be coloured per
        character, which a screen reader would read out letter by letter. This
        plain copy is what assistive technology actually reads: the textarea
        points at it, so focusing the writing area announces the passage as
        prose. It sits outside the surface so it never becomes part of the
        surface's own text content.
      */}
      <p id={describedById} className="sr-only">
        {label ? `${label}. ` : ""}
        Skriv denne teksten: {engine.targetText}
      </p>
      <div
        className={`typing-surface ${statusClass}`}
        onClick={() => inputRef.current?.focus()}
        data-testid="typing-surface"
        style={{ ["--visible-lines" as string]: String(VISIBLE_LINES) }}
      >
      <div className="typing-viewport">
        <div
          ref={linesRef}
          className="typing-lines"
          style={{ transform: `translateY(${-offset}px)` }}
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
            <p className="m-0 mt-6 text-ink-faint" aria-hidden="true">
              {preview}
            </p>
          )}
        </div>
      </div>
      <textarea
        ref={inputRef}
        className="typing-input"
        aria-label="Skrivefelt"
        aria-describedby={describedById}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        data-testid="typing-input"
      />
      </div>
    </>
  );
}

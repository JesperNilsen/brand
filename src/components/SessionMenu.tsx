"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type SessionMenuProps = {
  open: boolean;
  /** Paused time so far, so the menu can say what it has already cost. */
  pausedMs: number;
  pauseCount: number;
  /** True once the reader has typed something worth keeping. */
  hasProgress: boolean;
  /** Back to the text. */
  onResume: () => void;
  /** Finish and store the result. */
  onFinish: () => void;
  /** Leave without storing anything. */
  onDiscard: () => void;
};

/**
 * The way out of a session, in one place.
 *
 * Opening it pauses: the clock must not run while the reader is reading a menu
 * rather than the text. That pause is recorded like any other, so a session
 * where someone stepped away cannot pass as an unbroken one.
 */
export function SessionMenu({
  open,
  pausedMs,
  pauseCount,
  hasProgress,
  onResume,
  onFinish,
  onDiscard,
}: SessionMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);

  /**
   * `aria-modal` alone is a promise, not a mechanism: a screen reader's virtual
   * cursor can still walk the page behind the panel, which is a paused session
   * the reader is not meant to be reading. `inert` on the rest of the shell is
   * what makes the promise true, and it removes those elements from the tab
   * order too, so the Tab handling below becomes a fallback rather than the
   * only thing holding focus in.
   *
   * The panel is portalled to <body> (see the render below). It is written
   * inside <main>, so inerting the shell in place would have made the dialog
   * inert along with everything else — the one element that must stay live.
   * Here the panel is already a child of <body>, so it is simply skipped.
   */
  useEffect(() => {
    if (!open) return;
    const shell = Array.from(document.body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && !el.contains(panelRef.current),
    );
    for (const el of shell) el.inert = true;
    return () => {
      for (const el of shell) el.inert = false;
    };
  }, [open]);

  /**
   * Scoped to the panel, not to `document`. A document listener would catch
   * the very Escape that opened the menu: that keypress is still bubbling up
   * from the writing surface when React mounts this panel, so the menu opened
   * and closed again in one keystroke.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onResume();
      return;
    }
    if (e.key !== "Tab") return;
    // Focus stays inside: behind this panel is a writing surface, and Tab
    // reaching it would put the caret back in a paused session.
    const items = panelRef.current?.querySelectorAll<HTMLElement>("button");
    if (!items || items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Portalled, not rendered in place: the inert effect above needs the panel to
  // be a sibling of the shell rather than a descendant of it. Safe on the
  // server because `open` is only ever set by a click, so this returns null
  // during SSR and hydration.
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 p-4 backdrop-blur-sm"
      // The backdrop is a way back to the text, not a way out of the session.
      onClick={(e) => {
        if (e.target === e.currentTarget) onResume();
      }}
    >
      <div
        ref={panelRef}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-menu-title"
        data-testid="session-menu"
        className="card w-full max-w-sm bg-paper"
      >
        <h2 id="session-menu-title" className="label mb-1">
          Økten er satt på pause
        </h2>
        <p className="mb-6 text-sm text-ink-muted" data-testid="session-menu-paused">
          {pauseCount === 1 && pausedMs < 1000
            ? "Klokken står stille mens denne menyen er åpen."
            : `Klokken står stille. Pauset ${pauseCount} ${
                pauseCount === 1 ? "gang" : "ganger"
              }, til sammen ${formatPause(pausedMs)}.`}
        </p>

        <div className="grid gap-2">
          <button
            ref={firstRef}
            type="button"
            className="btn btn-primary w-full"
            onClick={onResume}
            data-testid="menu-resume"
          >
            Fortsett å skrive
          </button>
          <button
            type="button"
            className="btn w-full"
            onClick={onFinish}
            data-testid="menu-finish"
          >
            Avslutt økten
            <span className="ml-2 text-sm text-ink-muted">lagres</span>
          </button>
          <button
            type="button"
            className="btn w-full"
            onClick={onDiscard}
            data-testid="menu-discard"
          >
            Forlat uten å lagre
            {hasProgress && (
              <span className="ml-2 text-sm text-ink-muted">ingenting lagres</span>
            )}
          </button>
        </div>

        <p className="mt-5 text-sm text-ink-muted">
          Escape tar deg tilbake til teksten.
        </p>
      </div>
    </div>,
    document.body,
  );
}

/** Whole seconds under a minute, then minutes and seconds. */
function formatPause(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} sekunder`;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec} s`;
}

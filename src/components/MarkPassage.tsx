"use client";

import { useCallback, useState } from "react";
import { markPassage } from "@/domain/practice-queue";
import type { TextEdition } from "@/domain/types";
import { getRepository } from "@/infra/repository";

type Props = {
  edition: TextEdition;
  /** The edition segment being typed. Drill pieces are not segments; see `disabled`. */
  segmentId: string;
  /** Where the reader has got to, in the ORIGINAL text's coordinates. */
  caret: number;
  /**
   * Off when the passage cannot honestly be identified: a text filter has
   * rewritten what is on screen, the session is over, or the mode types pieces
   * rather than segments.
   */
  disabled?: boolean;
  /** Why it is off, said plainly rather than left as a grey button. */
  disabledReason?: string;
};

/**
 * «Merk» — put the passage you are standing in into the repetition queue.
 *
 * **It must never take focus from the writing field.** D13 says the field is
 * never empty; a control that pulled focus out of it would break the session
 * the moment it was used — the input buffer would stop being primed, and a
 * soft keyboard's delete would produce no event to correct from. `mouseDown`
 * is therefore prevented, which is what actually moves focus on a click; the
 * click still fires. The confirmation is announced through an `aria-live`
 * region rather than by focusing anything, so a screen-reader user hears it
 * without leaving the text either.
 */
export function MarkPassage({ edition, segmentId, caret, disabled, disabledReason }: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  const mark = useCallback(async () => {
    const repo = getRepository();
    const queue = await repo.listQueue();
    const next = markPassage(queue, edition, segmentId, caret);
    if (next === null) {
      setNotice("Ingen passasje å merke her.");
      return;
    }
    if (next.length === queue.length) {
      setNotice("Allerede i køen.");
      return;
    }
    await repo.saveQueue(next);
    setNotice("Lagt i køen.");
  }, [edition, segmentId, caret]);

  return (
    <>
      <button
        type="button"
        className="btn"
        // The whole point: prevent the focus change, not the click.
        onMouseDown={(e) => e.preventDefault()}
        onClick={mark}
        disabled={disabled}
        title={disabled ? disabledReason : "Legg denne passasjen i øvingskøen"}
        data-testid="mark-passage"
      >
        Merk
      </button>
      <span className="sr-only" role="status" aria-live="polite" data-testid="mark-notice">
        {notice ?? ""}
      </span>
    </>
  );
}

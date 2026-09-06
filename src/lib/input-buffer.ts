/**
 * The hidden textarea is never allowed to be empty.
 *
 * On a desktop keyboard, correction never depended on the field's contents:
 * Blink turns the Backspace key event into a delete command and emits
 * `beforeinput` with `deleteContentBackward` whether or not there is anything
 * behind the caret. A soft keyboard has no key event to work from. It asks the
 * field to delete what is behind the caret — Android's
 * `InputConnection.deleteSurroundingText`, and the same editing pipeline on
 * iOS — and an empty field has nothing behind the caret, so the browser emits
 * no event at all. Not one that arrives with the wrong `inputType`: none.
 *
 * Measured rather than assumed. In Chromium, `document.execCommand("delete")`
 * — the same editing command the IME path routes through — fires nothing on an
 * empty textarea and fires `deleteContentBackward` on a filled one. That is
 * the whole bug: on a phone, insertion worked and correction was unreachable,
 * because the field this app types into is written to by nobody.
 *
 * So the field carries a run of filler for the keyboard to bite into. Zero
 * width spaces, because assistive technology reads a textarea's value out and
 * U+200B is not spoken; the field is transparent besides, so nothing shows.
 * A run rather than a single character, because a held backspace or a
 * delete-word gesture consumes more than one, and it is refilled after every
 * event that got through, so it cannot be exhausted.
 *
 * The buffer is kept on every platform, not only where the bug shows. A
 * touch-only code path would be a second input layer that no desktop run ever
 * exercises, and the desktop key path is provably indifferent to what the
 * field holds.
 */

/** U+200B ZERO WIDTH SPACE: deletable, invisible, and not read aloud. */
const FILLER = "​";

/** Deep enough to survive a held backspace or a delete-word gesture. */
export const BUFFER_LENGTH = 32;

const BUFFER = FILLER.repeat(BUFFER_LENGTH);

/**
 * Restore the field to a full buffer with the caret at its end, so the next
 * delete has something behind the caret to consume. Cheap and idempotent:
 * called after every event that reached the field.
 */
export function primeInputBuffer(el: HTMLTextAreaElement | null | undefined) {
  if (!el) return;
  if (el.value !== BUFFER) el.value = BUFFER;
  const end = BUFFER_LENGTH;
  if (el.selectionStart !== end || el.selectionEnd !== end) {
    el.setSelectionRange(end, end);
  }
}

/**
 * True when the field has been eaten into, i.e. an editing command deleted
 * from the buffer instead of from text the user can see. Used as a fallback
 * for keyboards that report an `inputType` we do not recognise.
 */
export function bufferWasConsumed(el: HTMLTextAreaElement | null | undefined) {
  return !!el && el.value.length < BUFFER_LENGTH;
}

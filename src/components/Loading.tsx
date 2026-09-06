/**
 * The shape of waiting.
 *
 * Every async view used to render `null`, which reads as a broken route rather
 * than as a page that is working — and since the corpus moved out of the
 * bundle that blank frame is the network wait the product promises to keep
 * under two seconds. The bars hold the measure so nothing jumps when the
 * content lands, and the message is announced once via `role="status"` so the
 * wait is not silent for a screen reader either.
 */
export function Loading({ message, lines = 3 }: { message: string; lines?: number }) {
  return (
    <div className="placeholder" data-testid="loading">
      <div aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="placeholder-line" />
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-muted" role="status">
        {message}
      </p>
    </div>
  );
}

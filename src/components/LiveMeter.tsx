import type { Metrics } from "@/domain/engine/metrics";
import { formatClock, formatPercent, formatWpm } from "@/lib/format";

type Props = {
  metrics: Metrics;
  /** Remaining ms for timed sessions; elapsed is shown otherwise. */
  remainingMs: number | null;
  elapsedMs: number;
};

/** Quiet live readout: time, net WPM, accuracy. */
export function LiveMeter({ metrics, remainingMs, elapsedMs }: Props) {
  return (
    <dl
      className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-ink-muted"
      aria-live="off"
      data-testid="live-meter"
    >
      <div>
        <dt className="label">{remainingMs !== null ? "Igjen" : "Tid"}</dt>
        <dd className="tabular-nums text-ink">
          {formatClock(remainingMs !== null ? remainingMs : elapsedMs)}
        </dd>
      </div>
      <div>
        <dt className="label">Netto WPM</dt>
        <dd className="tabular-nums text-ink">{formatWpm(metrics)}</dd>
      </div>
      <div>
        <dt className="label">Nøyaktighet</dt>
        <dd className="tabular-nums text-ink">
          {metrics.comparedCharacterCount === 0 ? "—" : formatPercent(metrics.accuracy)}
        </dd>
      </div>
    </dl>
  );
}

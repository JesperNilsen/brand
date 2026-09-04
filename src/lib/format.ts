import type { Metrics } from "@/domain/engine/metrics";

const nb = "nb-NO";

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} s`;
  return `${m} min ${s} s`;
}

export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toLocaleString(nb, { maximumFractionDigits: 1 })} %`;
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString(nb, { maximumFractionDigits: digits });
}

/** Net WPM, or a dash while the measurement is provisional. */
export function formatWpm(metrics: Metrics): string {
  if (metrics.provisional || metrics.comparedCharacterCount === 0) return "—";
  return formatNumber(metrics.netWpm);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(nb, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

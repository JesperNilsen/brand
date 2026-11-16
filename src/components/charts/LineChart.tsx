"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A line chart that can be read without seeing it (Måling; PR C reuses it).
 *
 * Three ways in, all from the same numbers: the drawing, a `<desc>` that says
 * the data in words for a screen reader, and a table under «Som tabell». The
 * table is the chart's fasit: it shows every point, formatted exactly as the
 * caller formats the figures beside it, so a number in the chart can always be
 * checked against the number on the page.
 *
 * Series are told apart without colour: solid against dashed, and a label at
 * the end of each line. Colour only repeats it — net in `--accent`, raw in
 * `--ink-muted`, marks as «×» in `--error`, the grid in `--rule` (decorative,
 * so the 3:1 boundary floor does not apply to it). See «Diagrammer» in
 * DESIGN.md.
 *
 * The svg is drawn at the width it actually has rather than scaled from a
 * fixed viewBox, so its text stays at the type scale on a phone instead of
 * shrinking with the drawing.
 */

export type LineSeries = {
  id: string;
  /** Column heading and the name in `<desc>`. */
  label: string;
  /** Short name printed at the line's end, before its last value. */
  endLabel: string;
  tone: "accent" | "muted";
  dashed?: boolean;
  /** One per x. */
  values: number[];
};

export type LineChartProps = {
  /** The svg's `<title>`. */
  title: string;
  x: number[];
  /** Heading of the x column in the table, and the first word of `<desc>`. */
  xLabel: string;
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  series: LineSeries[];
  /** Counts per x, drawn as «×» under the plot where above zero. */
  marks?: { label: string; values: number[] };
  caption?: ReactNode;
  testId?: string;
};

const HEIGHT = 200;
const PAD = { top: 10, left: 34, bottom: 34, endLabel: 78 };
/** The strip under the plot where marks sit, so they never cover a line. */
const MARK_STRIP = 12;
const DEFAULT_WIDTH = 544;
const LABEL_GAP = 15;

const TONE_STROKE = { accent: "stroke-accent", muted: "stroke-ink-muted" } as const;
const TONE_FILL = { accent: "fill-accent", muted: "fill-ink-muted" } as const;

function extreme(values: number[], pick: (a: number, b: number) => boolean): number {
  let at = 0;
  for (let i = 1; i < values.length; i++) if (pick(values[i], values[at])) at = i;
  return at;
}

/** `<desc>`: the range, then each series' end, peak and low, then the marks. */
export function describeLineChart(p: LineChartProps): string {
  const n = p.x.length;
  if (n === 0) return "Ingen målepunkter.";
  const parts = [`${p.xLabel} ${p.formatX(p.x[0])}–${p.formatX(p.x[n - 1])}.`];
  for (const s of p.series) {
    const hi = extreme(s.values, (a, b) => a > b);
    const lo = extreme(s.values, (a, b) => a < b);
    parts.push(
      `${s.label}: slutter på ${p.formatY(s.values[n - 1])}, ` +
        `høyest ${p.formatY(s.values[hi])} ved ${p.formatX(p.x[hi])}, ` +
        `lavest ${p.formatY(s.values[lo])} ved ${p.formatX(p.x[lo])}.`,
    );
  }
  if (p.marks) {
    const total = p.marks.values.reduce((a, b) => a + b, 0);
    const at = p.marks.values.filter((v) => v > 0).length;
    parts.push(
      total === 0
        ? `${p.marks.label}: ingen.`
        : `${p.marks.label}: ${total} i alt, i ${at} av ${n} målepunkter.`,
    );
  }
  return parts.join(" ");
}

/** Round numbers for the y grid: 1, 2 or 5 times a power of ten. */
function niceStep(max: number, ticks: number): number {
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}

/** Time steps that read as time: whole seconds and minutes. */
const X_STEPS_MS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].map(
  (s) => s * 1000,
);

function xStep(maxX: number, ticks: number): number {
  return X_STEPS_MS.find((s) => maxX / s <= ticks) ?? X_STEPS_MS.at(-1)!;
}

/** Push end labels apart vertically so two lines ending close stay readable. */
function spread(ys: number[], top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) {
    order[k].y = Math.max(order[k].y, order[k - 1].y + LABEL_GAP);
  }
  const overflow = order.length ? order.at(-1)!.y - bottom : 0;
  if (overflow > 0) for (const o of order) o.y -= overflow;
  for (const o of order) o.y = Math.max(o.y, top);
  const out = new Array<number>(ys.length);
  for (const o of order) out[o.i] = o.y;
  return out;
}

export function LineChart(props: LineChartProps) {
  const { title, x, xLabel, formatX, formatY, series, marks, caption, testId } = props;
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const frame = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(200, Math.round(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = x.length;
  const left = PAD.left;
  const right = width - PAD.endLabel;
  const top = PAD.top;
  const bottom = HEIGHT - PAD.bottom - MARK_STRIP;
  const plotW = Math.max(1, right - left);
  const plotH = bottom - top;

  const maxX = n ? Math.max(...x) : 1;
  const maxY = Math.max(1, ...series.flatMap((s) => s.values));
  const yStep = niceStep(maxY, 4);
  const yTop = Math.ceil(maxY / yStep) * yStep;
  const sx = (v: number) => left + (v / (maxX || 1)) * plotW;
  const sy = (v: number) => bottom - (v / yTop) * plotH;

  const yTicks: number[] = [];
  for (let v = 0; v <= yTop + 1e-9; v += yStep) yTicks.push(v);
  const step = xStep(maxX, Math.max(2, Math.floor(plotW / 64)));
  const xTicks: number[] = [];
  for (let v = 0; v <= maxX + 1e-9; v += step) xTicks.push(v);

  const ends = n ? spread(series.map((s) => sy(s.values[n - 1])), top + 4, bottom) : [];

  return (
    <figure ref={frame} className="m-0 w-full" data-testid={testId}>
      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block max-w-full"
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>{describeLineChart(props)}</desc>
        <g aria-hidden="true">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line
                x1={left}
                x2={right}
                y1={sy(v)}
                y2={sy(v)}
                className="stroke-rule"
                strokeWidth={1}
              />
              <text
                x={left - 6}
                y={sy(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-ink-muted text-label tabular-nums"
              >
                {formatY(v)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text
              key={`x${v}`}
              x={sx(v)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-ink-muted text-label tabular-nums"
            >
              {formatX(v)}
            </text>
          ))}
          {series.map((s, i) =>
            n === 0 ? null : (
              <g key={s.id}>
                <path
                  data-series={s.id}
                  d={s.values
                    .map((v, k) => `${k === 0 ? "M" : "L"}${sx(x[k]).toFixed(1)},${sy(v).toFixed(1)}`)
                    .join("")}
                  fill="none"
                  className={TONE_STROKE[s.tone]}
                  strokeWidth={s.dashed ? 1.5 : 2}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle
                  cx={sx(x[n - 1])}
                  cy={sy(s.values[n - 1])}
                  r={2.5}
                  className={TONE_FILL[s.tone]}
                />
                <text
                  data-end-label
                  x={right + 8}
                  y={ends[i]}
                  dominantBaseline="middle"
                  className={`${TONE_FILL[s.tone]} text-label tabular-nums`}
                >
                  {`${s.endLabel} ${formatY(s.values[n - 1])}`}
                </text>
              </g>
            ),
          )}
          {marks?.values.map((v, k) =>
            v > 0 ? (
              <text
                key={`m${k}`}
                data-mark
                x={sx(x[k])}
                y={bottom + MARK_STRIP - 1}
                textAnchor="middle"
                className="fill-error text-label"
              >
                ×
              </text>
            ) : null,
          )}
        </g>
      </svg>
      {caption && <figcaption className="mt-2 text-meta text-ink-muted">{caption}</figcaption>}
      <details className="mt-3">
        <summary className="label cursor-pointer py-1">Som tabell</summary>
        <div className="mt-2 max-h-80 overflow-y-auto">
          <table className="w-full text-meta tabular-nums">
            <thead>
              <tr className="text-left">
                <th className="label py-1 pr-4 font-normal">{xLabel}</th>
                {series.map((s) => (
                  <th key={s.id} className="label py-1 pr-4 text-right font-normal">
                    {s.label}
                  </th>
                ))}
                {marks && <th className="label py-1 text-right font-normal">{marks.label}</th>}
              </tr>
            </thead>
            <tbody>
              {x.map((v, k) => (
                <tr key={k} className="border-t border-rule">
                  <td className="py-1 pr-4">{formatX(v)}</td>
                  {series.map((s) => (
                    <td key={s.id} className="py-1 pr-4 text-right">
                      {formatY(s.values[k])}
                    </td>
                  ))}
                  {marks && <td className="py-1 text-right">{marks.values[k]}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

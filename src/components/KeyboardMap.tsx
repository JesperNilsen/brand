"use client";

import { useState, type CSSProperties } from "react";
import {
  NORWEGIAN_ISO_ROWS,
  ROW_INDENTS,
  mapKeysToLayout,
  type KeySpec,
} from "@/domain/engine/keyboard-layout";
import { MIN_OPPORTUNITIES, focusCharacterLabel } from "@/domain/engine/practice-focus";
import type { KeyMeasurement } from "@/domain/types";
import { formatNumber, formatPercent } from "@/lib/format";

/**
 * The session's keys on a Norwegian keyboard (Måling).
 *
 * Every key carries its own number, so nothing is read off a colour scale:
 * «Treff» is the share of first tries that were right, «Fart» the mean flow
 * interval in milliseconds. A key under the floor shows «–» — the same
 * MIN_OPPORTUNITIES the practice list uses, for the same reason: a rate over
 * a handful of tries is noise that reads as a diagnosis. Fart is held to the
 * floor on its own intervals, which can be fewer than the key's tries.
 *
 * Treff is rounded down, so «100» on a key means none were missed.
 */
type View = "treff" | "fart";

const DASH = "–";

function treff(k: KeyMeasurement | undefined): string {
  if (!k || k.firstTries < MIN_OPPORTUNITIES) return DASH;
  return String(Math.floor((k.firstTryCorrect / k.firstTries) * 100));
}

function fart(k: KeyMeasurement | undefined): string {
  if (!k || k.flowCount < MIN_OPPORTUNITIES) return DASH;
  return String(Math.round(k.flowMsSum / k.flowCount));
}

/** Grid placement in quarter-key columns, for the narrow and the wide grid. */
function placements(): Map<string, CSSProperties> {
  const out = new Map<string, CSSProperties>();
  NORWEGIAN_ISO_ROWS.forEach((row, r) => {
    const isSpace = r === NORWEGIAN_ISO_ROWS.length - 1;
    let narrow = isSpace ? ROW_INDENTS[r] : 0;
    let wide = ROW_INDENTS[r];
    for (const key of row) {
      const w = key.width ?? 1;
      // The enter key is a single key wide on the narrow grid; see .kbd.
      const wNarrow = key.base === "\n" ? 1 : w;
      out.set(key.base, {
        "--col": 1 + Math.round(narrow * 4),
        "--span": Math.round(wNarrow * 4),
        "--col-sm": 1 + Math.round(wide * 4),
        "--span-sm": Math.round(w * 4),
        gridRow: r + 1,
      } as CSSProperties);
      narrow += wNarrow;
      wide += w;
    }
  });
  return out;
}

const PLACEMENT = placements();

function keyName(key: KeySpec): string {
  return key.base === " " || key.base === "\n" ? focusCharacterLabel(key.base) : key.label;
}

export function KeyboardMap({ keys }: { keys: readonly KeyMeasurement[] }) {
  const [view, setView] = useState<View>("treff");
  const { onKeys, others } = mapKeysToLayout(keys);
  const value = view === "treff" ? treff : fart;
  const allKeys = NORWEGIAN_ISO_ROWS.flat();
  const measured = allKeys.filter((k) => onKeys.has(k.base));

  return (
    <section className="mt-10" data-testid="keyboard-map" data-view={view}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="label">Tastene</p>
        <fieldset className="flex gap-2">
          <legend className="sr-only">Tall på tastene</legend>
          {(["treff", "fart"] as const).map((v) => (
            <label key={v} className="btn cursor-pointer py-1 text-meta">
              <input
                type="radio"
                name="keyboard-view"
                value={v}
                checked={view === v}
                onChange={() => setView(v)}
                className="sr-only"
              />
              {v === "treff" ? "Treff" : "Fart"}
            </label>
          ))}
        </fieldset>
      </div>
      <p className="mb-3 text-meta text-ink-muted" data-testid="keyboard-explainer">
        {view === "treff"
          ? "Andel riktige første forsøk per tast, i prosent."
          : "Gjennomsnittlig tid i millisekunder fra forrige riktige tastetrykk, regnet når det kom innen to sekunder. Lavere er raskere."}{" "}
        Store bokstaver og Shift-tegn regnes til tasten de skrives med. {DASH} betyr
        færre enn {MIN_OPPORTUNITIES} {view === "treff" ? "forsøk" : "målinger"}.
      </p>
      <div
        className="kbd"
        role="group"
        aria-label={view === "treff" ? "Treff per tast" : "Fart per tast"}
      >
        {allKeys.map((key) => {
          const shown = value(onKeys.get(key.base));
          return (
            <div
              key={key.base}
              className="kbd-key"
              style={PLACEMENT.get(key.base)}
              data-testid="kbd-key"
              data-key={key.base}
            >
              <span className="text-label text-ink-muted">{key.label}</span>
              <span
                className={`text-label tabular-nums ${shown === DASH ? "text-ink-muted" : ""}`}
                data-testid="kbd-num"
              >
                {shown === DASH ? (
                  <>
                    <span aria-hidden="true">{DASH}</span>
                    <span className="sr-only">ingen tall</span>
                  </>
                ) : (
                  shown
                )}
              </span>
            </div>
          );
        })}
      </div>
      {others.length > 0 && (
        <p className="mt-3 text-meta text-ink-muted" data-testid="keyboard-others">
          Andre tegn:{" "}
          {others.map((k, i) => (
            <span key={k.char}>
              {i > 0 ? " · " : ""}
              <span className="text-ink">{focusCharacterLabel(k.char)}</span>{" "}
              <span className="tabular-nums">{value(k)}</span>
            </span>
          ))}
        </p>
      )}
      <details className="mt-3">
        <summary className="label cursor-pointer py-1">Som tabell</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-meta tabular-nums" data-testid="keyboard-table">
            <thead>
              <tr className="text-left">
                <th className="label py-1 pr-4 font-normal">Tast</th>
                <th className="label py-1 pr-4 text-right font-normal">Første forsøk</th>
                <th className="label py-1 pr-4 text-right font-normal">Treff</th>
                <th className="label py-1 text-right font-normal">Fart (ms)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...measured.map((key) => ({ name: keyName(key), k: onKeys.get(key.base)! })),
                ...others.map((k) => ({ name: focusCharacterLabel(k.char), k })),
              ].map(({ name, k }) => (
                <tr key={k.char} className="border-t border-rule">
                  <td className="py-1 pr-4">{name}</td>
                  <td className="py-1 pr-4 text-right">{formatNumber(k.firstTries)}</td>
                  <td className="py-1 pr-4 text-right">
                    {k.firstTries < MIN_OPPORTUNITIES
                      ? DASH
                      : formatPercent(k.firstTryCorrect / k.firstTries)}
                  </td>
                  <td className="py-1 text-right">{fart(k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

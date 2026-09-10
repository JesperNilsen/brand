import type { CharacterCount, CharacterMiss } from "@/domain/engine/metrics";
import {
  focusCharacterLabel,
  practiceClasses,
  rankPracticeFocus,
} from "@/domain/engine/practice-focus";
import { formatPercent } from "@/lib/format";

/**
 * «Verdt å øve på» — the ranked answer to what actually goes wrong (Q-014).
 *
 * Deliberately a paragraph and a short list, not a panel. PRODUCT.md says the
 * text dominates the screen, and this block sits under numbers the reader
 * already came for; it earns its place by being short enough to read in one
 * glance and specific enough to act on.
 *
 * The absent/empty distinction is load-bearing and is why `misses` is optional
 * here rather than defaulted to `[]` at the call site. A session written before
 * Q-013 has no measurement at all, and saying «ingen feil» about it would be a
 * lie the reader has no way to detect. See SessionResult.misses.
 */
export function PracticeFocus({
  misses,
  opportunities,
  testId = "practice-focus",
}: {
  misses?: readonly CharacterMiss[];
  opportunities?: readonly CharacterCount[];
  testId?: string;
}) {
  if (!misses || !opportunities) {
    return (
      <section className="mb-10" data-testid={testId} data-measured="no">
        <p className="label mb-2">Verdt å øve på</p>
        <p className="text-meta text-ink-muted">
          Denne økten ble skrevet før appen begynte å måle hvilke tegn som gikk
          galt, så det finnes ikke noe å vise her. Det er ikke det samme som at
          den var feilfri.
        </p>
      </section>
    );
  }

  const ranked = rankPracticeFocus(misses, opportunities);
  const classes = practiceClasses(misses, opportunities).filter((c) => c.misses > 0);

  if (ranked.length === 0 && classes.length === 0) {
    return (
      <section className="mb-10" data-testid={testId} data-measured="yes">
        <p className="label mb-2">Verdt å øve på</p>
        <p className="text-meta text-ink-muted">
          Ingenting peker seg ut ennå. Et tegn vises her først når det har stått
          i teksten ofte nok til at andelen betyr noe.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-10" data-testid={testId} data-measured="yes">
      <p className="label mb-2">Verdt å øve på</p>
      {classes.length > 0 && (
        <p className="mb-3 text-meta text-ink-muted" data-testid="focus-classes">
          {classes.map((c, i) => (
            <span key={c.id}>
              {i > 0 ? " " : ""}
              {c.label}: <span className="tabular-nums">{formatPercent(c.rate)}</span> av{" "}
              <span className="tabular-nums">{c.opportunities}</span>.
            </span>
          ))}
        </p>
      )}
      {ranked.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="focus-list">
          {ranked.map((f) => (
            <li key={f.expected} className="text-meta" data-testid="focus-row">
              <span className="font-medium" data-testid="focus-char">
                {focusCharacterLabel(f.expected)}
              </span>{" "}
              <span className="text-ink-muted">
                blir oftest{" "}
                <span className="font-medium">{focusCharacterLabel(f.topTyped)}</span> —{" "}
                <span className="tabular-nums">{formatPercent(f.rate)}</span> av{" "}
                <span className="tabular-nums">{f.opportunities}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

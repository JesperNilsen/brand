"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  confidenceLabel,
  explainOrthography,
  formStatusLabel,
  getOrthographySource,
  implementationNotice,
  implementationStatusLabel,
  judgeOrthography,
  officialStatusLabel,
  orthographyItems,
  periodLabel,
  requireOrthography,
  type OrthographyItem,
  type OrthographyProfile,
  type OrthographyRule,
  type OrthographyVerdict,
  type SourceRef,
} from "@/domain/orthography";
import { useWritingNorm } from "@/hooks/useWritingNorm";

/**
 * The orthography exercise (rettskrivning), as opposed to every other mode,
 * which is transcription. Here any form the chosen norm allows is right, and
 * its standing is said out loud: a sideform is accepted as a sideform, never
 * passed off as the textbook form.
 */
export function OrthographyView() {
  const { orthographyId } = useWritingNorm();
  const o = requireOrthography(orthographyId);
  const items = orthographyItems(o);

  return (
    <div className="prose-measure">
      <p className="label mb-2">Rettskrivning</p>
      <h1 className="mb-1 text-heading" data-testid="orthography-title">
        {o.displayName}
      </h1>
      <p className="mb-3 text-sm text-ink-muted">
        {periodLabel(o)} · {o.authority} · {officialStatusLabel(o.officialStatus)}
      </p>
      <p className="mb-8 text-sm" data-testid="orthography-status">
        <strong>{implementationStatusLabel(o.implementationStatus)}.</strong>{" "}
        {implementationNotice(o)} Normen velges i språkmenyen øverst.
      </p>

      {items.length > 0 ? (
        // Keyed by norm: a different norm is a different exercise, and its
        // position and tally start over rather than carry across.
        <Exercise key={o.id} orthography={o} items={items} />
      ) : (
        <p className="mb-10 text-sm text-ink-muted" data-testid="orthography-no-exercise">
          Det finnes ingen øvelse for denne normen ennå, fordi Brand ikke har dokumenterte
          ordformer å kontrollere mot.
        </p>
      )}

      <Rules orthography={o} />
      <Sources refs={o.sources} />
    </div>
  );
}

type Tally = Record<OrthographyVerdict["kind"], number>;

function Exercise({ orthography, items }: { orthography: OrthographyProfile; items: OrthographyItem[] }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<OrthographyVerdict | null>(null);
  const [tally, setTally] = useState<Tally>({ accepted: 0, outside: 0, undocumented: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const item = items[index % items.length];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (verdict) {
      setIndex((i) => i + 1);
      setAnswer("");
      setVerdict(null);
      inputRef.current?.focus();
      return;
    }
    if (!answer.trim()) return;
    const v = judgeOrthography(item.entry, answer);
    setVerdict(v);
    setTally((t) => ({ ...t, [v.kind]: t[v.kind] + 1 }));
  }

  return (
    <section aria-labelledby="exercise-heading" className="mb-10">
      <h2 id="exercise-heading" className="label mb-3">
        Skriv ordet etter normen
      </h2>
      <form onSubmit={submit} className="card">
        <p className="mb-1 text-sm text-ink-muted">
          Ord {(index % items.length) + 1} av {items.length}
          {item.entry.gloss ? ` · ${item.entry.gloss}` : ""}
        </p>
        <p className="mb-4 text-heading" data-testid="orthography-cue">
          «{item.cue.form}»
          {item.cue.note && <span className="ml-2 text-sm text-ink-muted">{item.cue.note}</span>}
        </p>
        <label className="block">
          <span className="sr-only">Skriv ordet etter {orthography.displayName}</span>
          <input
            ref={inputRef}
            className="control w-full text-lead"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            readOnly={verdict !== null}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            lang="nb"
            data-testid="orthography-answer"
          />
        </label>
        <div className="mt-4">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={verdict === null && !answer.trim()}
            data-testid="orthography-submit"
          >
            {verdict ? "Neste ord" : "Kontroller"}
          </button>
        </div>
        {verdict && <Feedback orthography={orthography} item={item} verdict={verdict} />}
      </form>
      <p className="mt-3 text-sm text-ink-muted" data-testid="orthography-tally">
        {tally.accepted} godkjent · {tally.outside} utenfor normen · {tally.undocumented} ikke
        dokumentert
      </p>
    </section>
  );
}

const HEADING: Record<OrthographyVerdict["kind"], string> = {
  accepted: "Godkjent",
  outside: "Utenfor normen",
  undocumented: "Ikke dokumentert",
};

function Feedback(props: { orthography: OrthographyProfile; item: OrthographyItem; verdict: OrthographyVerdict }) {
  const rule = props.orthography.ruleset.rules.find((r) => r.id === props.item.entry.ruleId);
  const tone = props.verdict.kind === "outside" ? "text-error" : "";
  return (
    <div className="mt-5 border-t border-rule pt-4" role="status" data-testid="orthography-feedback">
      <p className={`mb-1 font-semibold ${tone}`} data-verdict={props.verdict.kind}>
        {HEADING[props.verdict.kind]}
      </p>
      <p className="mb-2">{explainOrthography(props.orthography, props.verdict)}</p>
      {rule && (
        <p className="text-sm text-ink-muted">
          {rule.summary} <Citation refs={props.item.entry.sources ?? rule.sources} />
          {(props.item.entry.confidence ?? rule.confidence) !== "verified-primary" && (
            <> ({confidenceLabel(props.item.entry.confidence ?? rule.confidence)})</>
          )}
        </p>
      )}
    </div>
  );
}

function Citation({ refs }: { refs: readonly SourceRef[] }) {
  return (
    <>
      {refs.map((ref, i) => {
        const source = getOrthographySource(ref.sourceId);
        return (
          <span key={`${ref.sourceId}-${i}`}>
            {i === 0 ? "Kilde: " : "; "}
            {source ? (
              <a href={source.url} className="underline" target="_blank" rel="noreferrer">
                {source.title}
              </a>
            ) : (
              ref.sourceId
            )}
            , {ref.locator}
          </span>
        );
      })}
      .
    </>
  );
}

function Rules({ orthography }: { orthography: OrthographyProfile }) {
  const { rules, words } = orthography.ruleset;
  return (
    <section aria-labelledby="rules-heading" className="mb-10">
      <h2 id="rules-heading" className="label mb-3">
        Reglene Brand kjenner
      </h2>
      {rules.length === 0 ? (
        <p className="text-sm text-ink-muted">Ingen ennå.</p>
      ) : (
        <ol className="grid gap-5" data-testid="orthography-rules">
          {rules.map((rule) => (
            <RuleItem key={rule.id} rule={rule} examples={words.filter((w) => w.ruleId === rule.id)} />
          ))}
        </ol>
      )}
    </section>
  );
}

function RuleItem({ rule, examples }: { rule: OrthographyRule; examples: OrthographyProfile["ruleset"]["words"] }) {
  return (
    <li data-testid={`rule-${rule.id}`}>
      <p>
        {rule.summary}
        {rule.confidence === "unverified" && <span className="label ml-2">ubekreftet</span>}
      </p>
      {examples.length > 0 && (
        <p className="text-sm text-ink-muted">
          {examples
            .map((w) => w.forms.map((f) => `${f.form} (${formStatusLabel(f.status)})`).join(" / "))
            .join(" · ")}
        </p>
      )}
      <p className="text-sm text-ink-muted">
        <Citation refs={rule.sources} /> {confidenceLabel(rule.confidence)}
      </p>
    </li>
  );
}

function Sources({ refs }: { refs: readonly SourceRef[] }) {
  return (
    <section aria-labelledby="sources-heading">
      <h2 id="sources-heading" className="label mb-3">
        Kilder for normen
      </h2>
      <ul className="grid gap-2 text-sm">
        {refs.map((ref, i) => {
          const s = getOrthographySource(ref.sourceId);
          if (!s) return null;
          return (
            <li key={`${ref.sourceId}-${i}`}>
              {s.authors ? `${s.authors}: ` : ""}
              <a href={s.url} className="underline" target="_blank" rel="noreferrer">
                <i>{s.title}</i>
              </a>{" "}
              ({s.year}), {ref.locator}.
            </li>
          );
        })}
      </ul>
    </section>
  );
}

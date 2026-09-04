"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { orderedSegments } from "@/domain/content/registry";
import { newId } from "@/domain/ids";
import { getGameMode } from "@/domain/modes/registry";
import type { SessionPlan } from "@/domain/modes/types";
import {
  currentSegment,
  nextSegment,
  runnerElapsedMs,
  runnerMetrics,
  runnerRemainingMs,
  toSessionResult,
  type RunnerState,
} from "@/domain/session/runner";
import type { ReadingProgress, TextEdition, UserPreferences, Work } from "@/domain/types";
import { requireTextFilter } from "@/domain/text-filter";
import { getRepository } from "@/infra/repository";
import { useTypingSession } from "@/hooks/useTypingSession";
import {
  buildPlan,
  editionLabel,
  nonstopProgressKey,
  parseSessionParams,
  progressFromRunner,
  rememberChoice,
  resolveWorkAndEdition,
} from "@/lib/session-flow";
import { LiveMeter } from "./LiveMeter";
import { TypingSurface } from "./TypingSurface";

type Loaded = {
  plan: SessionPlan;
  work: Work;
  edition: TextEdition;
  prefs: UserPreferences;
  progress: ReadingProgress | null;
};

export function SessionView() {
  const params = useSearchParams();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paramString = params.toString();

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams(paramString);
    const parsed = parseSessionParams((k) => q.get(k));
    (async () => {
      try {
        if (!parsed) throw new Error("Ingen økt valgt.");
        const repo = getRepository();
        const prefs = await repo.getPreferences();
        const resolved = resolveWorkAndEdition(parsed, prefs.languageProfileId);
        if (!resolved) throw new Error("Fant ikke verket.");
        const progress =
          parsed.mode === "nonstop"
            ? await repo.getProgress(
                nonstopProgressKey(resolved.edition, resolved.work, prefs.languageProfileId),
              )
            : null;
        const plan = buildPlan(parsed, prefs, progress);
        await repo.savePreferences(rememberChoice(prefs, plan));
        if (alive) setLoaded({ plan, ...resolved, prefs, progress });
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [paramString]);

  if (error) {
    return (
      <div className="prose-measure">
        <p className="mb-4">{error}</p>
        <Link href="/" className="btn">
          Til forsiden
        </Link>
      </div>
    );
  }
  if (!loaded) return null;
  return <ActiveSession key={loaded.plan.id} {...loaded} />;
}

function ActiveSession({ plan, work, edition, progress }: Loaded) {
  const router = useRouter();
  const mode = getGameMode(plan.gameModeId);
  const progressRef = useRef<ReadingProgress | null>(progress);
  const [saving, setSaving] = useState(false);

  const saveProgress = useCallback(
    async (state: RunnerState) => {
      if (plan.gameModeId !== "nonstop") return;
      const repo = getRepository();
      const next = progressFromRunner(state, edition, progressRef.current, new Date().toISOString());
      if (next) {
        progressRef.current = next;
        await repo.saveProgress(next);
      } else {
        await repo.deleteProgress(nonstopProgressKey(edition, work, plan.languageProfileId));
        progressRef.current = null;
      }
    },
    [plan.gameModeId, plan.languageProfileId, edition, work],
  );

  const onEnd = useCallback(
    async (state: RunnerState) => {
      setSaving(true);
      const id = newId("s");
      const result = toSessionResult(state, Date.now(), id);
      await getRepository().addSession(result);
      await saveProgress(state);
      router.push(`/resultat/${id}`);
    },
    [router, saveProgress],
  );

  const { state, clock, handlers, pasteNotice, stop } = useTypingSession(plan, {
    onEnd,
    onSegmentComplete: saveProgress,
  });

  if (!state) return null;
  const segment = currentSegment(state);
  const upcoming = nextSegment(state);
  const metrics = runnerMetrics(state, clock);
  const remaining = runnerRemainingMs(state, clock);
  const elapsed = runnerElapsedMs(state, clock);
  const finished = state.status === "completed" || state.status === "abandoned";
  // Position within the edition (not within the plan), so Nonstop shows "4 av 12".
  const editionOrder = orderedSegments(edition);
  const segmentNumber = editionOrder.findIndex((s) => s.id === segment.id) + 1;
  const segmentTotal = editionOrder.length;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="label">
            {mode?.displayName} · {work.author}, <i>{work.title}</i>
          </p>
          <p className="text-sm text-ink-muted">
            {segment.label ?? `Segment ${segmentNumber}`}
            {plan.gameModeId === "nonstop" ? ` · ${segmentNumber} av ${segmentTotal}` : ""}
            {" · "}
            <Link href="/om" className="hover:text-accent">
              {editionLabel(edition)}
            </Link>
            {requireTextFilter(plan.textFilterId).altersText
              ? ` · ${requireTextFilter(plan.textFilterId).displayName}`
              : ""}
          </p>
        </div>
        <LiveMeter metrics={metrics} remainingMs={remaining} elapsedMs={elapsed} />
      </div>

      <TypingSurface
        engine={state.engine}
        handlers={handlers}
        autoFocus
        disabled={finished}
        preview={
          plan.endRule.kind !== "all-segments" && upcoming
            ? upcoming.text.split("\n").slice(0, 3).join("\n")
            : undefined
        }
      />

      <div className="mt-10 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
        {!finished && (
          <button type="button" className="btn" onClick={stop} data-testid="stop-button">
            {plan.endRule.kind === "all-segments" ? "Avbryt" : "Avslutt økten"}
          </button>
        )}
        {finished && <span>{saving ? "Lagrer …" : "Ferdig."}</span>}
        <span aria-live="polite">
          {pasteNotice
            ? "Innliming er skrudd av, slik at resultatene kan sammenlignes. Skriv teksten selv."
            : state.status === "idle"
              ? "Begynn å skrive når du er klar. Klokken starter ved første tegn."
              : ""}
        </span>
      </div>
    </div>
  );
}

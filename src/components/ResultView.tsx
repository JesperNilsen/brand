"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getEditionById, getWork } from "@/domain/content/registry";
import { getGameMode } from "@/domain/modes/registry";
import { metricsFromResult } from "@/domain/session/runner";
import type { SessionResult } from "@/domain/types";
import { getRepository } from "@/infra/repository";
import { formatDuration, formatNumber, formatPercent, formatWpm } from "@/lib/format";
import { editionLabel, nextSegmentAfter, sessionHref } from "@/lib/session-flow";

export function ResultView({ id }: { id: string }) {
  const [result, setResult] = useState<SessionResult | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getRepository()
      .getSession(id)
      .then((r) => {
        if (alive) setResult(r);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (result === undefined) return null;
  if (result === null) {
    return (
      <div className="prose-measure">
        <p className="mb-4">Fant ikke denne økten.</p>
        <Link href="/" className="btn">
          Til forsiden
        </Link>
      </div>
    );
  }

  const work = getWork(result.workId);
  const edition = work ? getEditionById(work, result.editionId) : undefined;
  const mode = getGameMode(result.gameModeId);
  const metrics = metricsFromResult(result);
  const lastSegmentId = result.segmentIds.at(-1);
  const next =
    result.gameModeId === "passage" && edition && lastSegmentId
      ? nextSegmentAfter(edition, lastSegmentId)
      : undefined;

  return (
    <div className="prose-measure" data-testid="result">
      <p className="label mb-2">
        {result.status === "completed" ? "Se resultat" : "Avbrutt økt"}
      </p>
      <h1 className="mb-1 text-2xl">
        {work ? (
          <>
            {work.author}: <i>{work.title}</i>
          </>
        ) : (
          result.workId
        )}
      </h1>
      <p className="mb-8 text-sm text-ink-muted">
        {mode?.displayName ?? result.gameModeId} · {edition ? editionLabel(edition) : result.editionId}
      </p>

      <dl className="mb-10 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
        <Stat label="Netto WPM" value={formatWpm(metrics)} big testId="net-wpm" />
        <Stat label="Nøyaktighet" value={formatPercent(result.accuracy)} big testId="accuracy" />
        <Stat label="Varighet" value={formatDuration(result.durationMs)} big />
        <Stat label="Tegn" value={formatNumber(result.typedCharacterCount)} />
        <Stat label="Feil" value={formatNumber(result.errorCount)} testId="errors" />
        <Stat label="Brutto WPM" value={metrics.provisional ? "—" : formatNumber(result.grossWpm)} />
      </dl>
      {metrics.provisional && (
        <p className="mb-8 text-sm text-ink-muted">
          Økten var under fem sekunder; hastighet vises ikke for så korte økter.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {next && (
          <Link
            href={sessionHref({ mode: "passage", workId: result.workId, segmentId: next.id })}
            className="btn btn-primary"
          >
            Neste passasje
          </Link>
        )}
        {result.gameModeId === "nonstop" && (
          <Link href={sessionHref({ mode: "nonstop", workId: result.workId })} className="btn btn-primary">
            Fortsett
          </Link>
        )}
        {result.gameModeId === "timed" && (
          <Link
            href={sessionHref({ mode: "timed", workId: result.workId, limitMs: result.durationMs })}
            className="btn btn-primary"
          >
            En gang til
          </Link>
        )}
        {result.gameModeId === "passage" && lastSegmentId && (
          <Link
            href={sessionHref({ mode: "passage", workId: result.workId, segmentId: lastSegmentId })}
            className="btn"
          >
            Skriv samme utdrag igjen
          </Link>
        )}
        <Link href="/historikk" className="btn">
          Historikk
        </Link>
        <Link href="/" className="btn">
          Forsiden
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  big,
  testId,
}: {
  label: string;
  value: string;
  big?: boolean;
  testId?: string;
}) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className={`tabular-nums ${big ? "text-2xl" : "text-lg"}`} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

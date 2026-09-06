"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getEditionById,
  getWork,
  loadedEdition,
  loadEditionText,
} from "@/domain/content/registry";
import { getGameMode } from "@/domain/modes/registry";
import { metricsFromResult } from "@/domain/session/runner";
import { requireTextFilter } from "@/domain/text-filter";
import type { SessionResult, TextEdition } from "@/domain/types";
import { getRepository, isPersistent } from "@/infra/repository";
import { getLastSession } from "@/lib/last-session";
import { Loading } from "./Loading";
import { formatDuration, formatNumber, formatPercent, formatWpm } from "@/lib/format";
import { editionLabel, nextSegmentAfter, sessionHref } from "@/lib/session-flow";

export function ResultView({ id }: { id: string }) {
  const [result, setResult] = useState<SessionResult | null | undefined>(undefined);
  const [unsaved, setUnsaved] = useState(false);
  /** Only needed to name the next passage; the numbers never wait on it. */
  const [fetchedText, setFetchedText] = useState<TextEdition | null>(null);

  useEffect(() => {
    let alive = true;
    const fallback = () => {
      const cached = getLastSession(id);
      if (!alive) return;
      setResult(cached);
      setUnsaved(cached !== null);
    };
    getRepository()
      .getSession(id)
      .then((r) => {
        if (!alive) return;
        if (r) {
          setResult(r);
          setUnsaved(!isPersistent());
        } else {
          fallback();
        }
      })
      .catch(fallback);
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!result || result.gameModeId !== "passage") return;
    const work = getWork(result.workId);
    const meta = work ? getEditionById(work, result.editionId) : undefined;
    if (!meta) return;
    // Normally already in memory: the reader just typed it, and the render
    // below reads that cache. Fetched only when an old result is opened cold,
    // and a failure there just means no link.
    if (loadedEdition(meta)) return;
    let alive = true;
    loadEditionText(meta)
      .then((e) => {
        if (alive) setFetchedText(e);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [result]);

  // The moment the loop pays off. A blank frame here reads as "your session is
  // gone" rather than "one moment".
  if (result === undefined) return <Loading message="Henter resultatet …" lines={2} />;
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
  const text = (edition ? loadedEdition(edition) : undefined) ?? fetchedText;
  const lastSegmentId = result.segmentIds.at(-1);
  const next =
    result.gameModeId === "passage" && text && lastSegmentId
      ? nextSegmentAfter(text, lastSegmentId)
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
        {requireTextFilter(result.textFilterId).altersText
          ? ` · ${requireTextFilter(result.textFilterId).displayName}`
          : ""}
      </p>
      {unsaved && (
        <p
          className="mb-8 -mt-6 rounded border border-rule bg-accent-soft px-4 py-3 text-sm"
          role="status"
          data-testid="unsaved-notice"
        >
          Denne økten ble ikke lagret. Tallene under er riktige, men de er borte
          når du forlater siden. Nettleseren tillater ikke lokal lagring her, for
          eksempel i et privat vindu.
        </p>
      )}
      {requireTextFilter(result.textFilterId).altersText && (
        <p className="mb-8 -mt-6 text-sm text-ink-muted">
          Skrevet med tekstformen «{requireTextFilter(result.textFilterId).displayName}».
          Tall herfra kan ikke sammenlignes direkte med økter skrevet som trykt.
        </p>
      )}
      {result.pauseCount > 0 && (
        <p className="mb-8 -mt-6 text-sm text-ink-muted" data-testid="paused-notice">
          Pauset {result.pauseCount} {result.pauseCount === 1 ? "gang" : "ganger"}
          {result.pausedMs >= 1000 ? ` (${formatDuration(result.pausedMs)})` : ""}. Pausen
          er trukket fra varigheten, så tallene gjelder tiden du faktisk skrev — men en
          økt med hvil er ikke uten videre sammenlignbar med en sammenhengende.
        </p>
      )}

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
            href={sessionHref({
              mode: "passage",
              workId: result.workId,
              segmentId: next.id,
              textFilterId: result.textFilterId,
            })}
            className="btn btn-primary"
          >
            Neste passasje
          </Link>
        )}
        {result.gameModeId === "nonstop" && (
          <Link
            href={sessionHref({
              mode: "nonstop",
              workId: result.workId,
              textFilterId: result.textFilterId,
            })}
            className="btn btn-primary"
          >
            Fortsett
          </Link>
        )}
        {result.gameModeId === "timed" && (
          <Link
            href={sessionHref({
              mode: "timed",
              workId: result.workId,
              limitMs: result.durationMs,
              textFilterId: result.textFilterId,
            })}
            className="btn btn-primary"
          >
            En gang til
          </Link>
        )}
        {result.gameModeId === "passage" && lastSegmentId && (
          <Link
            href={sessionHref({
              mode: "passage",
              workId: result.workId,
              segmentId: lastSegmentId,
              textFilterId: result.textFilterId,
            })}
            className="btn"
          >
            Skriv samme utdrag igjen
          </Link>
        )}
        {/*
          «Historikk» and «Forsiden» used to sit here too, which put up to five
          buttons in one row and let two duplicates of the header nav compete
          with the single action the reader came for. The header carries both,
          on every page, already. */}
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

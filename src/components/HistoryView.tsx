"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getEditionById, getWork } from "@/domain/content/registry";
import { getGameMode } from "@/domain/modes/registry";
import { metricsFromResult } from "@/domain/session/runner";
import { requireTextFilter } from "@/domain/text-filter";
import type { SessionResult } from "@/domain/types";
import { getRepository, isPersistent } from "@/infra/repository";
import { formatDate, formatDuration, formatPercent, formatWpm } from "@/lib/format";
import { editionLabel } from "@/lib/session-flow";
import { DataTransfer } from "./DataTransfer";
import { Loading } from "./Loading";

export function HistoryView() {
  const [sessions, setSessions] = useState<SessionResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** Bumped after an import, and by «Prøv igjen», so the list re-reads storage. */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let alive = true;
    getRepository()
      .listSessions({ limit: 200 })
      .then((s) => {
        if (alive) setSessions(s);
      })
      // Without this the page stayed blank forever when the read threw: no
      // message, no way out. ChooseView and SessionView already model this
      // failure; History was the one screen that did not.
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  if (failed) {
    return (
      <div className="prose-measure" data-testid="history-error">
        <p className="label mb-2">Historikk</p>
        <h1 className="mb-4 text-2xl" role="alert">
          Historikken kunne ikke leses.
        </h1>
        <p className="mb-6 text-ink-muted">
          Nettleserens lokale lager svarte ikke. Øktene dine er sannsynligvis
          uskadd — prøv igjen.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setFailed(false);
            setReloadToken((n) => n + 1);
          }}
          data-testid="retry-button"
        >
          Prøv igjen
        </button>
      </div>
    );
  }

  if (!sessions) return <Loading message="Henter historikken …" lines={3} />;

  return (
    <div>
      <p className="label mb-2">Historikk</p>
      <h1 className="mb-4 text-2xl">Tidligere økter</h1>
      {!isPersistent() && (
        <p
          className="prose-measure mb-8 rounded border border-rule bg-accent-soft px-4 py-3 text-sm"
          role="status"
          data-testid="no-storage-notice"
        >
          Nettleseren tillater ikke lokal lagring her, så ingen økter blir tatt
          vare på. Historikken er tom hver gang du kommer tilbake.
        </p>
      )}
      {sessions.length === 0 ? (
        <p className="prose-measure text-ink-muted">
          Ingen økter ennå.{" "}
          <Link href="/velg/passage" className="hover:text-accent">
            Begynn med en passasje.
          </Link>
        </p>
      ) : (
        <>
        {/*
          Under 640px the nine-column table became a silent horizontal scroll:
          no affordance said it moved, and the columns a reader actually scans
          for (work, speed) were the ones pushed off-screen. The stacked list
          leads with those and folds the rest into one meta line. Edition and
          text form are control information and stay on the result page, which
          is where a reader who cares about them is going anyway.
        */}
        <ul className="sm:hidden" data-testid="history-list">
          {sessions.map((s) => {
            const work = getWork(s.workId);
            return (
              <li key={s.id} className="border-t border-rule py-3">
                <Link href={`/resultat/${s.id}`} className="no-underline">
                  <span className="flex items-baseline justify-between gap-4">
                    <span>
                      {work ? (
                        <>
                          {work.author}, <i>{work.title}</i>
                        </>
                      ) : (
                        s.workId
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatWpm(metricsFromResult(s))} wpm
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-ink-muted">
                    {formatDate(s.startedAt)} ·{" "}
                    {getGameMode(s.gameModeId)?.displayName ?? s.gameModeId} ·{" "}
                    {formatPercent(s.accuracy)} · {formatDuration(s.durationMs)} ·{" "}
                    {s.status === "completed" ? "Fullført" : "Avbrutt"}
                    {s.pauseCount > 0 ? " · pauset" : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm" data-testid="history-table">
            <thead>
              <tr className="text-left">
                <th className="label py-2 pr-4 font-normal">Dato</th>
                <th className="label py-2 pr-4 font-normal">Modus</th>
                <th className="label py-2 pr-4 font-normal">Verk</th>
                <th className="label py-2 pr-4 font-normal">Utgave</th>
                <th className="label py-2 pr-4 font-normal">Tekstform</th>
                <th className="label py-2 pr-4 text-right font-normal">Netto WPM</th>
                <th className="label py-2 pr-4 text-right font-normal">Nøyaktighet</th>
                <th className="label py-2 pr-4 text-right font-normal">Varighet</th>
                <th className="label py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const work = getWork(s.workId);
                const edition = work ? getEditionById(work, s.editionId) : undefined;
                return (
                  <tr key={s.id} className="border-t border-rule align-baseline">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <Link href={`/resultat/${s.id}`} className="no-underline hover:underline">
                        {formatDate(s.startedAt)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{getGameMode(s.gameModeId)?.displayName ?? s.gameModeId}</td>
                    <td className="py-2 pr-4">
                      {work ? (
                        <>
                          {work.author}, <i>{work.title}</i>
                        </>
                      ) : (
                        s.workId
                      )}
                    </td>
                    <td className="py-2 pr-4 text-ink-muted">
                      {edition ? editionLabel(edition) : s.editionId}
                    </td>
                    <td className="py-2 pr-4 text-ink-muted">
                      {requireTextFilter(s.textFilterId).displayName}
                      {s.pauseCount > 0 && (
                        <span title="Økten ble pauset" data-testid="history-paused">
                          {" · pauset"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatWpm(metricsFromResult(s))}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatPercent(s.accuracy)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                      {formatDuration(s.durationMs)}
                    </td>
                    <td className="py-2 text-ink-muted">
                      {s.status === "completed" ? "Fullført" : "Avbrutt"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      <DataTransfer onImported={() => setReloadToken((n) => n + 1)} />
    </div>
  );
}

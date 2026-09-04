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

export function HistoryView() {
  const [sessions, setSessions] = useState<SessionResult[] | null>(null);

  useEffect(() => {
    let alive = true;
    getRepository()
      .listSessions({ limit: 200 })
      .then((s) => {
        if (alive) setSessions(s);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!sessions) return null;

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
        <div className="overflow-x-auto">
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
      )}
    </div>
  );
}

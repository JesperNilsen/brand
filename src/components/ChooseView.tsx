"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  defaultEdition,
  estimateMinutes,
  getContentPack,
  getWork,
  listContentPacks,
  listWorks,
  orderedSegments,
} from "@/domain/content/registry";
import { requireGameMode } from "@/domain/modes/registry";
import { TIMED_LIMIT_OPTIONS_MS } from "@/domain/modes/timed";
import { DEFAULT_TEXT_FILTER_ID } from "@/domain/text-filter";
import type {
  ReadingProgress,
  TextFilterId,
  UserPreferences,
  Work,
} from "@/domain/types";
import { getRepository } from "@/infra/repository";
import { formatClock } from "@/lib/format";
import {
  clampTimedLimit,
  editionLabel,
  nonstopProgressKey,
  sessionHref,
} from "@/lib/session-flow";
import { TextFilterChooser } from "./TextFilterChooser";

type Props = { modeId: string };

export function ChooseView({ modeId }: Props) {
  const mode = requireGameMode(modeId);
  const params = useSearchParams();
  const router = useRouter();
  const workId = params.get("work");
  const work = workId ? getWork(workId) : undefined;
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [limitMs, setLimitMs] = useState<number>(clampTimedLimit(undefined));
  const [textFilterId, setTextFilterId] =
    useState<TextFilterId>(DEFAULT_TEXT_FILTER_ID);

  useEffect(() => {
    let alive = true;
    getRepository()
      .getPreferences()
      .then((p) => {
        if (!alive) return;
        setPrefs(p);
        setLimitMs(clampTimedLimit(p.lastTimedLimitMs));
        setTextFilterId(p.textFilterId ?? DEFAULT_TEXT_FILTER_ID);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!work || !prefs || mode.id !== "nonstop") return;
    let alive = true;
    const edition = defaultEdition(work, prefs.languageProfileId);
    getRepository()
      .getProgress(nonstopProgressKey(edition, work, prefs.languageProfileId))
      .then((p) => {
        if (alive) setProgress(p);
      });
    return () => {
      alive = false;
    };
  }, [work, prefs, mode.id]);

  const chooseFilter = (next: TextFilterId) => {
    setTextFilterId(next);
    const repo = getRepository();
    void repo
      .getPreferences()
      .then((p) => repo.savePreferences({ ...p, textFilterId: next }));
  };

  if (!work) {
    return (
      <div className="prose-measure">
        <p className="label mb-2">{mode.displayName}</p>
        <h1 className="mb-2 text-2xl">Velg et verk</h1>
        <p className="mb-8 text-ink-muted">{mode.description}</p>
        {listContentPacks().map((pack) => (
          <section key={pack.id} className="mb-8" aria-labelledby={`pack-${pack.id}`}>
            <h2 id={`pack-${pack.id}`} className="label mb-3">
              {pack.title}
            </h2>
            <ul className="grid gap-3">
              {listWorks(pack.id).map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/velg/${mode.id}?work=${encodeURIComponent(w.id)}`}
                    className="card"
                  >
                    <span className="block text-lg">
                      {w.author}: <i>{w.title}</i>
                      {w.publishedYear ? (
                        <span className="text-ink-muted"> ({w.publishedYear})</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm text-ink-muted">{pack.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  const profileId = prefs?.languageProfileId ?? "brand-riksmaal";
  const edition = defaultEdition(work, profileId);
  const segments = orderedSegments(edition);
  const pack = getContentPack(work.contentPackId);

  return (
    <div className="prose-measure">
      <p className="label mb-2">
        <Link href={`/velg/${mode.id}`} className="no-underline hover:underline">
          {mode.displayName}
        </Link>
        {" · "}
        {pack?.title}
      </p>
      <h1 className="mb-1 text-2xl">
        {work.author}: <i>{work.title}</i>
      </h1>
      <p className="mb-8 text-sm text-ink-muted">
        {editionLabel(edition)} ·{" "}
        <Link href="/om" className="hover:text-accent">
          om utgaven
        </Link>
      </p>

      <TextFilterChooser value={textFilterId} onChange={chooseFilter} />

      {mode.id === "passage" && (
        <ul className="grid gap-2">
          {segments.map((s, i) => (
            <li key={s.id}>
              <Link
                href={sessionHref({
                  mode: "passage",
                  workId: work.id,
                  segmentId: s.id,
                  textFilterId,
                })}
                className="card flex items-baseline justify-between gap-4"
              >
                <span>{s.label ?? `Utdrag ${i + 1}`}</span>
                <span className="shrink-0 text-sm text-ink-muted">
                  {s.wordCount} ord · ca. {estimateMinutes(s.wordCount)} min
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {mode.id === "nonstop" && (
        <NonstopStart
          work={work}
          progress={progress}
          totalSegments={segments.length}
          textFilterId={textFilterId}
        />
      )}

      {mode.id === "timed" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(
              sessionHref({ mode: "timed", workId: work.id, limitMs, textFilterId }),
            );
          }}
        >
          <fieldset className="mb-6">
            <legend className="label mb-3">Tidsgrense</legend>
            <div className="flex flex-wrap gap-3">
              {TIMED_LIMIT_OPTIONS_MS.map((ms) => (
                <label key={ms} className="btn cursor-pointer">
                  <input
                    type="radio"
                    name="limit"
                    value={ms}
                    checked={limitMs === ms}
                    onChange={() => setLimitMs(ms)}
                    className="sr-only"
                  />
                  {formatClock(ms)}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="btn btn-primary">
            Start
          </button>
        </form>
      )}
    </div>
  );
}

function NonstopStart({
  work,
  progress,
  totalSegments,
  textFilterId,
}: {
  work: Work;
  progress: ReadingProgress | null;
  totalSegments: number;
  textFilterId: TextFilterId;
}) {
  const done = progress?.completedSegmentIds.length ?? 0;
  return (
    <div>
      {progress ? (
        <p className="mb-4 text-ink-muted">
          Du har skrevet {done} av {totalSegments} segmenter. Fortsett der du slapp.
        </p>
      ) : (
        <p className="mb-4 text-ink-muted">
          {totalSegments} segmenter i rekkefølge. Fremdriften lagres etter hvert segment.
        </p>
      )}
      <Link
        href={sessionHref({ mode: "nonstop", workId: work.id, textFilterId })}
        className="btn btn-primary"
      >
        {progress ? "Fortsett" : "Begynn"}
      </Link>
    </div>
  );
}

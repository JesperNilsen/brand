"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWork, worksWithDrills } from "@/domain/content/registry";
import { listChoosableModes, listGameModes } from "@/domain/modes/registry";
import type { UserPreferences } from "@/domain/types";
import { getRepository } from "@/infra/repository";
import { continueHref, sessionHref } from "@/lib/session-flow";

export function HomeView() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    let alive = true;
    getRepository()
      .getPreferences()
      .then((p) => {
        if (alive) setPrefs(p);
      });
    return () => {
      alive = false;
    };
  }, []);

  const href = prefs ? continueHref(prefs) : null;
  const lastWork = prefs?.lastWorkId ? getWork(prefs.lastWorkId) : undefined;
  const lastMode = prefs?.lastModeId
    ? listGameModes().find((m) => m.id === prefs.lastModeId)
    : undefined;
  // Which edition the pieces come from is data: today one bank is cut, and the
  // day a second lands this is where the choice gets made rather than a name
  // to find and change. The old chooser stays as the fallback for a build with
  // no bank at all.
  const drillWork = worksWithDrills(prefs?.languageProfileId ?? "brand-riksmaal")[0];

  return (
    <div className="prose-measure">
      <p className="label mb-2">Skriv deg inn i god norsk prosa</p>
      <h1 className="mb-8 text-title leading-tight">Med ro, rytme og målbar fremgang.</h1>

      {/*
        Three branches, not two. `prefs === null` means the stored preferences
        are still in flight, and the old code fell through to the first-time
        branch during that window — so the returning reader, who is the only
        user V1 has, saw "Begynn med en passasje" flash before it swapped to
        "Fortsett". The placeholder holds the button's space so nothing jumps.
      */}
      {prefs === null ? (
        <section className="mb-10" data-testid="home-cta-pending">
          <span className="btn btn-primary text-base opacity-55" aria-hidden="true">
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          </span>
          <p className="mt-3 text-sm text-ink-muted" role="status">
            Henter siste økt …
          </p>
        </section>
      ) : href && lastWork && lastMode ? (
        <section className="mb-10">
          <Link href={href} className="btn btn-primary text-base">
            Fortsett
          </Link>
          <p className="mt-3 text-sm text-ink-muted">
            {lastMode.displayName} · {lastWork.author}, <i>{lastWork.title}</i>
          </p>
        </section>
      ) : drillWork ? (
        /*
          The first-time reader had a chooser here: the primary action asked
          them to pick a work before they had written a word. This starts them
          typing instead. It replaces only this branch — a returning reader
          still lands on «Fortsett», which is what they came for.
        */
        <section className="mb-10">
          <Link
            href={sessionHref({ mode: "drill", workId: drillWork.id })}
            className="btn btn-primary text-base"
            data-testid="home-drill"
          >
            Skriv med en gang
          </Link>
          <p className="mt-3 text-sm text-ink-muted">
            Ti korte biter fra {drillWork.author}s <i>{drillWork.title}</i> — sitater,
            setningsdeler og ord. Eller{" "}
            <Link href="/velg/passage" className="underline">
              velg et utdrag selv
            </Link>
            .
          </p>
        </section>
      ) : (
        <section className="mb-10">
          <Link href="/velg/passage" className="btn btn-primary text-base">
            Begynn med en passasje
          </Link>
          <p className="mt-3 text-sm text-ink-muted">
            Velg et utdrag fra Ibsens <i>Brand</i> og skriv det ferdig.
          </p>
        </section>
      )}

      <section aria-labelledby="modes-heading">
        <h2 id="modes-heading" className="label mb-3">
          Velg en modus
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {listChoosableModes().map((m) => (
            <li key={m.id}>
              <Link href={`/velg/${m.id}`} className="card h-full">
                <span className="block text-lead">{m.displayName}</span>
                <span className="mt-1 block text-sm text-ink-muted">{m.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

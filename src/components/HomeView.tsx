"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWork } from "@/domain/content/registry";
import { listGameModes } from "@/domain/modes/registry";
import type { UserPreferences } from "@/domain/types";
import { getRepository } from "@/infra/repository";
import { continueHref } from "@/lib/session-flow";

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

  return (
    <div className="prose-measure">
      <p className="label mb-2">Skriv deg inn i god norsk prosa</p>
      <h1 className="mb-8 text-3xl leading-tight">Med ro, rytme og målbar fremgang.</h1>

      {href && lastWork && lastMode ? (
        <section className="mb-10">
          <Link href={href} className="btn btn-primary text-base">
            Fortsett
          </Link>
          <p className="mt-3 text-sm text-ink-muted">
            {lastMode.displayName} · {lastWork.author}, <i>{lastWork.title}</i>
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
          {listGameModes().map((m) => (
            <li key={m.id}>
              <Link href={`/velg/${m.id}`} className="card h-full">
                <span className="block text-lg">{m.displayName}</span>
                <span className="mt-1 block text-sm text-ink-muted">{m.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

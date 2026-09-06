import type { Metadata } from "next";
import { defaultEdition, listContentPacks, listWorks } from "@/domain/content/registry";
// A server component, so the notes are rendered to HTML here and never reach
// the reader as JavaScript. See `editorial-notes.generated.ts`.
import { EDITORIAL_NOTES } from "@/domain/content/editorial-notes.generated";
import { brandRiksmaal } from "@/domain/language/brand-riksmaal";

export const metadata: Metadata = { title: "Om BRAND" };

export default function AboutPage() {
  return (
    <article className="prose-measure">
      <p className="label mb-2">Om</p>
      <h1 className="mb-6 text-2xl">BRAND og Brand Training Edition</h1>

      <p className="mb-4">
        BRAND er en skrive- og tasteapp for konsentrert trening på norsk prosa. Navnet viser til
        Henrik Ibsens <i>Brand</i>, startverket i biblioteket, og til en tydelig språklig
        identitet. Alt lagres lokalt i nettleseren; det finnes ingen konto og ingen sky.
      </p>

      <h2 className="mb-2 mt-8 text-xl">Språkprofilen {brandRiksmaal.displayName}</h2>
      <p className="mb-4">{brandRiksmaal.description}</p>

      <h2 className="mb-2 mt-8 text-xl">To utgaver av hver tekst</h2>
      <p className="mb-4">
        Hver tekst finnes i to atskilte lag. <b>Originalteksten</b> er en nøyaktig transkripsjon
        av kilden, med kildehenvisning og uten språklige inngrep. <b>Brand Training Edition</b> er
        den teksten du normalt skriver: ortografien er forsiktig modernisert til profilens
        former, mens syntaks, rytme, billedbruk, dialog og ordvalg står urørt. Originalen
        overskrives aldri, og hver normalisering er loggført i utgavens redaksjonsnotater.
      </p>
      <p className="mb-4">
        Tastemotoren sammenligner alltid mot nøyaktig den utgaven som vises. Hastighet og
        nøyaktighet regnes slik: brutto WPM = tegn / 5 / minutter, nøyaktighet = riktige tegn /
        skrevne tegn, netto WPM = brutto WPM × nøyaktighet. «Feil» er antall feiltastede tegn i
        løpet av økten, også de du rettet med Backspace.
      </p>

      <h2 className="mb-2 mt-8 text-xl">Kilder og redaksjonsnotater</h2>
      {listContentPacks().map((pack) =>
        listWorks(pack.id).map((work) => {
          // The edition the reader actually types. `getEdition` returned the
          // first training edition in the array, which is whichever the
          // generator emitted first — so this page described v1 while three of
          // four works served v2.
          const training = defaultEdition(work, brandRiksmaal.id);
          return (
            <section key={work.id} className="mb-8">
              <h3 className="mb-1 text-lg">
                {work.author}: <i>{work.title}</i>
                {work.publishedYear ? ` (${work.publishedYear})` : ""}
              </h3>
              <p className="mb-2 text-sm text-ink-muted">
                {work.source.provider} · {work.source.digitalEdition} ·{" "}
                <a href={work.source.sourceUrl} rel="noreferrer">
                  kilde
                </a>
                <br />
                {work.source.license}
                <br />
                Kontrollstatus: {work.source.verificationStatus}
                <br />
                Redaksjonell lesning:{" "}
                {training.reviewStatus === "reviewed"
                  ? `lest av ${training.reviewedBy}${training.reviewedAt ? ` (${training.reviewedAt})` : ""}`
                  : "ikke lest av redaktør ennå"}
              </p>
              {work.source.editorialNotes?.map((n) => (
                <p key={n} className="mb-1 text-sm text-ink-muted">
                  {n}
                </p>
              ))}
              {training.kind === "training-edition" && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer">
                    Redaksjonsnotater for Brand Training Edition {training.version}
                  </summary>
                  <ul className="mt-2 list-disc pl-5 text-ink-muted">
                    {EDITORIAL_NOTES[training.id]?.map((n) => (
                      <li key={n} className="mb-1">
                        {n}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          );
        }),
      )}
    </article>
  );
}

"use client";

import Link from "next/link";
import { listOrthographies, requireOrthography } from "@/domain/orthography";
import { useWritingNorm } from "@/hooks/useWritingNorm";

/**
 * Says so when the chosen norm is not the one the text is written in.
 *
 * Every edition today is a Brand training edition. A reader on Bokmål 1938
 * still types that edition, letter for letter — transcription follows the
 * text, not the norm — and should not be left to assume the text was
 * normalised to 1938. Renders nothing when the norm and the text agree.
 */
export function EditionNormNote({ editionProfileId }: { editionProfileId?: string }) {
  const { orthographyId } = useWritingNorm();
  const o = requireOrthography(orthographyId);
  if (editionProfileId && o.editionProfileId === editionProfileId) return null;
  // No profile means the original, in the rettskrivning it was printed in.
  // Named by the norm, as the menu names it, not by the edition profile id.
  const textNorm = listOrthographies().find((n) => n.editionProfileId === editionProfileId);
  const written = !editionProfileId
    ? "originalen, i rettskrivningen den ble trykt i"
    : `Brands treningsutgave, skrevet i ${textNorm?.displayName ?? editionProfileId}`;
  return (
    <p className="-mt-6 mb-8 text-sm text-ink-muted" data-testid="edition-norm-note">
      Teksten er {written}.
      {!o.editionProfileId && <> Ingen tekst er ennå normert etter {o.displayName}.</>} Avskrivning
      følger teksten slik den står; normen gjelder{" "}
      <Link href="/rettskrivning" className="underline">
        rettskrivningsøvelsen
      </Link>
      .
    </p>
  );
}

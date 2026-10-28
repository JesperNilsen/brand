import type { OrthographySource } from "./types";

/**
 * Every source a norm, rule or word entry may cite. A `SourceRef` naming an
 * id not listed here fails tests/orthography/registry.test.ts.
 *
 * Primary sources come first for each period. Where only a secondary account
 * was read, the entry citing it says `verified-secondary`, and
 * docs/spec/ORTHOGRAPHY_NORMS.md names the primary that still has to be read.
 */
export const ORTHOGRAPHY_SOURCES: readonly OrthographySource[] = [
  {
    id: "brand-skrivestandard-0.1",
    title: "Brand – skrivestandard og gjennomføringsplan, versjon 0.1",
    year: 2026,
    kind: "house",
    url: "https://github.com/JesperNilsen/brand/blob/main/standards/brand/brand-skrivestandard-v0.1.md",
    rights: "Brands egen standard, i dette repoet.",
  },
  {
    id: "sprakradet-rettskrivingsvedtak",
    title: "Rettskrivingsvedtak (oversikt med lenker til originaldokumentene)",
    authors: "Språkrådet",
    year: 2024,
    kind: "secondary",
    url: "https://sprakradet.no/nyord-og-rettskrivingsendringer/normering-av-norsk/rettskrivingsvedtak/",
    rights: "Nettside; sitert, ikke kopiert.",
  },
  {
    id: "sprakradet-bokmal-1900",
    title: "Bokmålsrettskrivningen på 1900-tallet",
    authors: "Språkrådet",
    year: 2024,
    kind: "secondary",
    url: "https://sprakradet.no/nyord-og-rettskrivingsendringer/normering-av-norsk/rettskrivingsvedtak/bokmalsrettskrivningen-pa-1900-tallet/",
    rights: "Nettside; sitert, ikke kopiert.",
  },
];

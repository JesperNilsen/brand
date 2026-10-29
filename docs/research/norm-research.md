# Norm research for Brand - bokmål/riksmål spelling norms

Companion to `norm-research.json` (same folder). Language: English with Norwegian terms.
Nothing was written to any repository. Everything read from the web was treated as data.

## 1. Headline

- Seven norm entries (`bokmal-1907` ... `bokmal-current`), 59 rules, ~190 word examples.
  58 rules are `verified-primary`, 1 is `verified-secondary`, 0 `unverified`.
- Unusually good news: **all six primary documents are on nb.no with a public-domain flag and
  machine-readable OCR (ALTO XML) reachable from api.nb.no**. I read them page by page and checked
  every quoted snippet (<= 15 words) mechanically against the OCR text; the most important entries
  (gate, kake, dyp, hester, bok, kake/pike/hånd, the 1917 word-list legend, St.meld. 100 p. 30)
  were also checked against the page images.
- "verified-primary" means: the rule and the *after* form are in the primary text at the stated
  printed page. Some *before* forms come only from SNL/Guttu/Løland - each example's `note` says so.
- Språkrådet's own pages, riksmalsforbundet.no and the Stortinget viewer cannot be scraped (403 / 912-byte
  stub / JS viewer). I used the Wayback Machine for Språkrådet pages and found everything else at nb.no.

## 2. Sources (ids in JSON `sources[]`)

Primary (all page locators are PRINTED page numbers of that digitisation):

| id | what | nb.no item / note |
|---|---|---|
| aars-hofgaard-1907 | Norske retskrivnings-regler (1907), 88 s. | b176c37f0137b6a7ebd1e032eadf43ee |
| aars-1892 | pre-1907 baseline (only for gade/bog/mand) | 3d22831f5550a55c0c6d3e50fd05f0c3 |
| ny-rettskrivning-riksmaal-1918 | Den nye rettskrivning I. Riksmål (kgl. res. 21.12.1917) | 7c810cb2510e5454433266c698b8808e (same URN Språkrådet links) |
| ny-rettskrivning-1938-bokmal | Ny rettskrivning 1938, bokmål | f38dba23d26db5816758c6d48686eea9 |
| ny-laereboknormal-1959 | Ny læreboknormal 1959 | 59128586f3a97b94fba4bfb90f8e4559 (same URN Språkrådet links) |
| stmeld-100-1980-81 | KUD tilråding 30.4.1981 + Språkrådet proposal | 718ebcc48692079fe692150156b2f484 |
| rettskrivningsendringer-2005 | Norsk språkråd, "Rettskrivningsendringer fra 1. juli 2005" (55 s. PDF, KKD letter 16.2.2005) | sprakradet.no/wp-content/uploads/rettskriving2005.pdf, read via Wayback |
| sprakradet-vedtak-etter-2012 | Språkrådet table of vedtak 2014-2024 | Wayback copy |

Secondary used: SNL articles by Lars S. Vikør (1907, 1917, 1938, 1959, 1981, 2005, 2012, hovedform, riksmål),
Tor Guttu / Det Norske Akademi (normeringshistorie), Løland 1997 (Språknytt 1/1997, at Språkrådet),
Guttu in Språknytt 3/2005 (at nb.no). Ivar Berg's NTNU page is only a teaching-resource index: it contains
no rules and nothing was taken from it. Riksmålsforbundet's grammar chapter 18 could not be opened
(the site returns a 912-byte stub to every client, including the browser pane); Guttu's Akademi article is the
same chapter, so nothing was lost for the rules.

## 3. What each norm entry rests on

- **1907** (10 rules): hard consonants p/t/k list (pp. 44-49; gate p. 45, kake p. 46 image-checked), optional
  pairs bok/bog, eple/æble (p. 50), soft forms kept (vaaben, helvede), double consonant for disambiguation
  (pp. 52-53), å optional beside aa (§1 Anm., p. 5), nd/ld kept (pp. 16-17), shortened forms (pp. 53-54),
  weak verbs -et, adjectives -ig without -t (p. 86). Plural -er rests mainly on SNL (the 1907 book does NOT
  reprint item 4 of the royal-resolution appendix, forord p. 4); the forms hester, katter ... are in the book p. 85.
- **1917** (10): aa->å, hard consonants completed (bok, eple, saklig, tillit), double consonant in utlyd,
  ld/nd->ll/nn (fjell, mann), e for æ, gt->kt, -a feminine forms, kasta, and the pairs
  efter [etter], meget [mye], nu [nå], sne [snø], sprog [språk], syv [sju], tyve [tjuge].
  The word-list legend (p. 27) defines the notation: brackets or asterisk = tillatt (the radical tier);
  unmarked = obligatory (moderate). The 1918 word list is incomplete by its own admission.
- **1938** (12): hovedform/sideform system (forord p. 3), å and øy obligatory (p. 47), efter->etter (p. 24),
  nu/sne/sprog->nå/snø/språk, sju/tjue obligatory with syv/tyve allowed for pupils (p. 42), ll/nn extension,
  hva/ble/meg/deg/seg, ~1000 obligatory a-nouns (gate p. 28, bok p. 36 "i ufolk. bruk -en"), optional a-nouns
  (kake, pike, hånd p. 37), obligatory -a plural for barn/dyr/garn/troll, mi/di/si, verb sideforms.
- **1959** (8): same system; hovedregel p. 20 (bok, dør, gate, jord, seng, sol, stue obligatory -a; abstracts
  optional), woman words optional, reduced list of obligatory -a plurals (p. 25), meget/mye parallel,
  hvalp/hverken/hvirvel -> valp/verken/virvel (pp. 16-17), -a/-et jamstilt verbs.
- **1981** (7): St.meld. 100 + SNL. Rettskrivning: all feminines -a/-en, all neuters -a/-ene, ei/en free
  (p. 17); læreboknormal keeps ~640 obligatory -a words and frees ~440 (bok, dør, gate, seng, sol on p. 7/19/21);
  single-word table (p. 30, image-checked): fram/frem, kjelde/kilde, gras/gress, golv/gulv, hogg/hugg,
  graut/grøt, krage/krave, lyve; efter/nu/sne/sprog NOT readmitted. The department states it proposes no
  changes to Språkrådet's list (p. 10). Dates: Stortinget 1.6.1981, kgl. res. 24.7.1981 (Guttu), in force summer 1982 (SNL).
- **2005** (9): all from the decision PDF (printed pp. 3-31): "Skillet mellom hovedformer og sideformer faller bort",
  -a/-en for all feminines, -ning words, removed side forms (fra [frå], hun [ho], mandag [måndag], løk [lauk] ...),
  promoted forms (ba/bad, dro/drog, ga/gav, sto/stod, sju el. syv, mer el. mere, fler el. flere, hverken el. verken;
  tyve/tredve NOT approved), strong verbs brøt/brøyt, kløyvd infinitiv removed, -et readmitted.
- **current** (3): only Språkrådet's yearly decisions (hen 2022, Internett/kviss 2015, -el/-er neuter 2023).
  I found no system change after 2005 (nynorsk got the same reform in 2012, SNL).

## 4. Things an implementer must not get wrong (found while reading)

1. `formStatus` describes the **after** form: obligatory (no alternative), main/side (hoved-/sideform, bracketed =
   side), optional ("el.", "jamstilt", or 1917 brackets).
2. Do **not** map bek -> bekk (1907 p. 45 "bek" = tjære; bekk = stream; 1917 p. 13 keeps "bek" single).
3. 1907 hard-consonant rule is a *word list*, not a pattern: derivations keep soft consonants (kjøbmand,
   videnskab, sagfører, vaaben, helvede). Do not convert d/b/g -> t/p/k generically.
4. 1917 and 1938 are two-tier norms. Decide per profile whether "radical" forms (1917 brackets, 1938 sideformer)
   are offered; the primary sources label them but do not define a separate "radical normal".
5. 1938 p. 36: bok is obligatory -a ("i ufolk. bruk -en"); kake is only *optional* (p. 37). Do not generalise
   "feminine nouns = -a" per norm; use the lists.
6. 1959 -a rule is by semantic class (konkreter vs abstrakter, p. 20) with a word list; 1981 inverts it
   (optional for ~440 of the ~1100).
7. The three non-1907 rule documents contain only words *touched by the reform*, not full word lists (legends:
   1918 p. 27, 1938 forord p. 3, 1959 forord p. 3). A converter built from them cannot decide an untouched word's status.
8. OCR: multi-column lists are interleaved and have letter errors (Bt = St, 8 = s, 6 = d). Every list entry that is
   encoded must be checked against the image (`www.nb.no/services/image/resolver/{urn}_{nnnn}/full/full/0/native.jpg`).

## 5. What I could not verify (gaps)

1. **No complete machine-readable word lists for 1907-1981.** NB holds scans of Krogsrud & Seip (1938 norm
   word lists) and school word lists for 1959, but the catalogue flags them copyrighted/NORWAY-only. The only open
   dataset (Norsk ordbank bokmål 2005, CC BY 4.0) covers 2005+ only.
2. **Modern riksmål**: Riksmålsordlisten (9th ed. 2024) and NAOB could not be opened live and I found no licence
   text for either. SNL says nu/sne/efter/sprog are no longer in Riksmålsforbundet's norm - unverified against the list.
3. Parts of the primaries I did not read or could not read reliably: 1938 vowel/diphthong lists (OCR scrambled),
   1938 verb lists pp. 42-43, 1938 hv/kv side forms p. 23, 1959 verb list pp. 26-27 (hundreds of verbs),
   1917 "radical" lists beyond the bracketed pairs, St.meld. 100 verb list pp. 26-28 and Liste 1/2 word by word,
   the stortinget.no reading viewer for St.meld. 100 / Innst. S. nr. 306 (1980-81) (JS-rendered, no text reachable; nb.no copy used instead), the 2005 decision's alphabetical tables pp. 8-15,
   foreign-word spelling in all norms.
4. 1938 `hvad` as the pre-1938 form is from Guttu only (the 1917 OCR word list shows no `hvad` entry).
5. Dates: kgl. res. 24.7.1981 is from Guttu only; "in force summer 1982" from SNL only.
6. NB's terms of use for API/bulk use were not found (api.nb.no root is a Swagger UI).

## 6. Source access and licence notes

- nb.no flags (from the catalogue API, per digitisation): 1907, 1892, 1918, 1938 (f38dba..), 1959, St.meld. 100:
  `publicdomain`, accessible from everywhere. NB flags are per *digitisation*: another 1938 copy is flagged
  copyrighted, a third is NORWAY-only. Cite the item id you actually used.
- Copyright reasoning: Aars/Hofgaard died 1908; ministry/parliament documents are official publications.
  I did not verify the legal basis (e.g. åndsverkloven §9) in this session, so rely on NB's flag and quote only
  short snippets; do not republish OCR dumps.
- SNL articles: "fri gjenbruk" = CC BY-SA 3.0 per article (snl.no/.licenses/free); attribution + share-alike.
  Images inside articles have separate licences. Facts/word pairs need no licence, but if SNL text is quoted,
  attribute "Vikør, Lars S., Store norske leksikon, snl.no".
- Språknytt 3/2005 (nb.no): CC BY-NC-ND flag. Språkrådet decision PDF and web pages: no licence text seen.
- Guttu (Det Norske Akademi) and Løland: no licence statement; short facts only.
- Language Bank / Ordbank bokmål 2005: CC BY (link to CC BY 4.0), rightsholder Nasjonalbiblioteket; ordbokene.no
  says Bokmålsordboka/Nynorskordboka content may be used for any purpose incl. commercial; UiB licence page (read
  through a fetch summary) gives CC-BY 4.0 with the credit line "Bokmålsordboka/Nynorskordboka, Universitetet i
  Bergen og Språkrådet, ordbøkene.no, CC-BY 4.0." (re-read that page directly before relying on it).

## 7. Dictionary data (JSON `dictionaryData[]`)

| resource | covers | licence seen | redistribute? |
|---|---|---|---|
| Norsk ordbank bokmål 2005 (Språkbanken) | 2005+, 154,824 lemmas (2022 dump) | CC BY (4.0 link) | yes + attribution; over-generates |
| Bokmålsordboka/ordbokene.no | current | CC-BY 4.0 (UiB page), "any purpose" (ordbokene.no) | yes + attribution, confirm download route |
| NB scans of 1907/1918/1938/1959/1981 documents | 1907 reasonably complete; others only changed words | NB flag publicdomain; NB API terms unknown | spellings yes with citation; bulk OCR unclear |
| Krogsrud/Seip 1938 lists, 1959 school lists | full lists | NB flags copyrighted / NORWAY-only | no |
| NAOB (naob.no) | riksmål/moderat bokmål from 1800s | unknown | no/unclear |
| Riksmålsordlisten 2024 | riksmål | unknown | unclear |

## 8. Modern riksmål recommendation

Offer it only as one clearly labelled, unofficial profile ("Riksmål (Akademiets norm)") **under the bokmål submenu**,
not as its own language: same orthographic tradition, no official status (SNL), and Riksmålsforbundet itself says the
distance to moderate bokmål is "ikke lenger betydelig" since July 2005. Keep it distinct from the historical
"Riksmål 1907/1917" profiles (official norms of those years). Gate it behind two checks that I could not do: obtain
the actual delta from Riksmålsordlisten 2024 / Akademiets Norsk grammatikk (Askedal 2014/2017), and clear the licence.

## 9. Extras in the JSON

- `extras.testCorpora`: Løland 1997 prints the same Bull passage in Rolfsens lesebok under 1896/1909 (1907 rules), 1920
  (1917, moderate), 1939 (1938, radical), 1955 (1938, moderate) - ideal profile-conversion fixtures (not copied here).
- `extras.caveats`: notation for `formStatus` and locators.

## 10. Reproduce the primary reads

```
curl -s "https://api.nb.no/catalog/v1/items/<nbItemId>"                       # metadata + accessInfo (license)
curl -s "https://api.nb.no/catalog/v1/iiif/<nbItemId>/manifest"               # canvases; each has @seeAlso = ALTO XML
page image: https://www.nb.no/services/image/resolver/<URN>_<nnnn>/full/full/0/native.jpg
```
The OCR text files and the build/verification script are in the scratchpad (`dl/`, `build_norm_research.py`);
the script re-checks every quote against the OCR and fails if one is not found.

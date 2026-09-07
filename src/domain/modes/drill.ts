import type { DrillItem, TextSegment } from "../types";
import { mulberry32, shuffle } from "./random";
import type { GameModeDefinition, SessionPlan } from "./types";

/**
 * Kortform — short items cut from one edition, so a reader can start writing
 * without choosing a book first.
 *
 * It is a mode adapter, not a second engine. The bank is fetched like an
 * edition, the items become the plan's segments, and everything below —
 * the runner, the metrics, the storage — sees exactly what it sees for a
 * passage. `src/domain/engine/` does not learn that drills exist.
 *
 * One edition per session, deliberately: a plan carries a single `editionId`
 * and `editionContentHash`, and a session that mixed works could not honestly
 * say which text it was typed against.
 */

/** Items per session. Ten short pieces is a warm-up, not a reading. */
export const DRILL_ITEM_COUNT = 10;

/** Single words are drilled in runs; alone they are a keystroke, not a piece. */
export const WORDS_PER_RUN = 5;

/**
 * What a session is made of, when the bank can supply it.
 *
 * Quotes and clauses carry the rhythm, the word runs carry the letters this
 * corpus actually makes hard (æ/ø/å, the 1800s forms). A bank that cannot fill
 * a slot gives it to whatever it does have — the shape is a preference, not a
 * precondition, so a smaller bank still yields a session.
 */
export const DRILL_RECIPE: { quote: number; phrase: number; wordRun: number } = {
  quote: 4,
  phrase: 4,
  wordRun: 2,
};

const KIND_LABEL: Record<string, string> = {
  quote: "Sitat",
  phrase: "Setningsdel",
  word: "Ord",
};

function toSegment(item: DrillItem, order: number): TextSegment {
  return {
    id: item.id,
    order,
    text: item.text,
    label: KIND_LABEL[item.kind] ?? "Kortform",
    wordCount: item.wordCount,
  };
}

/** Five words on one line, typed as one piece. */
function toRun(items: DrillItem[], order: number): TextSegment {
  return {
    id: items.map((i) => i.id).join("+"),
    order,
    text: items.map((i) => i.text).join(" "),
    label: KIND_LABEL.word,
    wordCount: items.reduce((n, i) => n + i.wordCount, 0),
  };
}

/**
 * The pieces of one drill session, in the order they are typed.
 *
 * Deterministic in `seed` and nowhere else, so a test can pin an order and two
 * unseeded starts differ. No item appears twice in a session: the bank is
 * shuffled and then consumed, never sampled with replacement.
 */
export function buildDrillPieces(
  bank: readonly DrillItem[],
  seed: number,
  count: number = DRILL_ITEM_COUNT,
): TextSegment[] {
  const rand = mulberry32(seed);
  const byKind = (kind: DrillItem["kind"]) =>
    shuffle(
      bank.filter((i) => i.kind === kind),
      rand,
    );
  const quotes = byKind("quote");
  const phrases = byKind("phrase");
  const words = byKind("word");

  const pieces: TextSegment[] = [];
  const takeRun = () => {
    const run = words.splice(0, WORDS_PER_RUN);
    if (run.length > 0) pieces.push(toRun(run, 0));
  };

  for (let i = 0; i < DRILL_RECIPE.quote && quotes.length > 0; i += 1) {
    pieces.push(toSegment(quotes.shift()!, 0));
  }
  for (let i = 0; i < DRILL_RECIPE.phrase && phrases.length > 0; i += 1) {
    pieces.push(toSegment(phrases.shift()!, 0));
  }
  for (let i = 0; i < DRILL_RECIPE.wordRun && words.length > 0; i += 1) takeRun();

  // A bank short on one kind fills the gap from the others rather than serving
  // a thinner session — the reader asked for a warm-up, not for the bank's
  // composition to show through.
  const rest = shuffle([...quotes, ...phrases], rand);
  while (pieces.length < count && (rest.length > 0 || words.length > 0)) {
    if (rest.length > 0) pieces.push(toSegment(rest.shift()!, 0));
    else takeRun();
  }

  return shuffle(pieces, rand)
    .slice(0, count)
    .map((piece, order) => ({ ...piece, order }));
}

export const drillMode: GameModeDefinition = {
  id: "drill",
  displayName: "Kortform",
  description: "Korte biter fra én utgave — sitater, setningsdeler og ord.",
  availableInV1: true,
  // No chooser: not choosing is the mode. See GameMode.hasChooser.
  hasChooser: false,
  defaultErrorMode: "flow",
  settingsSchema: {},
  buildPlan(input): SessionPlan {
    const { edition, selection, drills } = input;
    if (!drills || drills.length === 0) {
      throw new Error(`Drill: ${edition.id} has no drill bank to draw from`);
    }
    const seed = selection.seed ?? Math.floor(Math.random() * 2 ** 31);
    const segments = buildDrillPieces(drills, seed);
    if (segments.length === 0) {
      throw new Error(`Drill: bank for ${edition.id} yielded no pieces`);
    }
    return {
      id: input.planId,
      gameModeId: "drill",
      languageProfileId: input.languageProfileId,
      contentPackId: input.contentPackId,
      workId: input.work.id,
      editionId: edition.id,
      editionVersion: edition.version,
      editionContentHash: edition.contentHash,
      errorMode: input.errorMode,
      textFilterId: input.textFilterId,
      segments,
      endRule: { kind: "all-segments" },
    };
  },
};

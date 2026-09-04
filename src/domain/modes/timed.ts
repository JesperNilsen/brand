import type { TextSegment } from "../types";
import type { GameModeDefinition, SessionPlan } from "./types";

export const TIMED_LIMIT_OPTIONS_MS = [60_000, 120_000, 300_000] as const;
export const DEFAULT_TIMED_LIMIT_MS = 120_000;

/** Generous typing speed used to size the segment stream so it never runs dry. */
const SIZING_WPM = 150;

/** Small deterministic PRNG (mulberry32) so plans are reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a stream of segments long enough for the time limit, in a shuffled
 * order with no immediate repetition (also across cycle boundaries).
 */
export function buildTimedStream(
  segments: TextSegment[],
  limitMs: number,
  seed: number,
): TextSegment[] {
  if (segments.length === 0) return [];
  const rand = mulberry32(seed);
  const neededChars = Math.ceil((limitMs / 60_000) * SIZING_WPM * 5);
  const stream: TextSegment[] = [];
  let chars = 0;
  while (chars < neededChars) {
    let cycle = shuffle(segments, rand);
    const last = stream.at(-1);
    if (last && segments.length > 1 && cycle[0].id === last.id) {
      cycle = [...cycle.slice(1), cycle[0]];
    }
    for (const s of cycle) {
      stream.push(s);
      chars += s.text.length + 1;
      if (chars >= neededChars) break;
    }
  }
  return stream;
}

export const timedMode: GameModeDefinition = {
  id: "timed",
  displayName: "På tid",
  description: "Skriv mot en tidsgrense med en rolig strøm av utdrag.",
  availableInV1: true,
  defaultErrorMode: "flow",
  settingsSchema: {
    limitMs: {
      type: "number",
      options: [...TIMED_LIMIT_OPTIONS_MS],
      default: DEFAULT_TIMED_LIMIT_MS,
    },
  },
  buildPlan(input): SessionPlan {
    const { edition, selection } = input;
    const limitMs = selection.limitMs ?? DEFAULT_TIMED_LIMIT_MS;
    if (!(limitMs > 0)) throw new Error("Timed: limitMs must be positive");
    const seed = selection.seed ?? Math.floor(Math.random() * 2 ** 31);
    const ordered = [...edition.segments].sort((a, b) => a.order - b.order);
    const segments = buildTimedStream(ordered, limitMs, seed);
    if (segments.length === 0) {
      throw new Error(`Timed: edition ${edition.id} has no segments`);
    }
    return {
      id: input.planId,
      gameModeId: "timed",
      languageProfileId: input.languageProfileId,
      contentPackId: input.contentPackId,
      workId: input.work.id,
      editionId: edition.id,
      errorMode: input.errorMode,
      segments,
      endRule: { kind: "time", limitMs },
    };
  },
};

import type {
  ErrorMode,
  GameMode,
  TextEdition,
  TextFilterId,
  TextSegment,
  Work,
} from "../types";

/** How a session ends. Decided by the game mode, enforced by the runner. */
export type EndRule =
  | { kind: "all-segments" }
  | { kind: "time"; limitMs: number }
  | { kind: "user-stop" };

/**
 * A SessionPlan is everything the runner needs: the ordered segments to type
 * and the end rule. It carries ids so results can be tied to the exact
 * edition, profile and mode, but the engine never reads them.
 */
export type SessionPlan = {
  id: string;
  gameModeId: string;
  languageProfileId: string;
  contentPackId: string;
  workId: string;
  editionId: string;
  errorMode: ErrorMode;
  /** Practice-form transform already applied to `segments`. */
  textFilterId: TextFilterId;
  segments: TextSegment[];
  endRule: EndRule;
};

export type PlanSelection = {
  /** Passage: the segment to type. */
  segmentId?: string;
  /** Nonstop: where to resume. */
  startSegmentId?: string;
  /** Timed: the time limit. */
  limitMs?: number;
  /** Timed: deterministic ordering for tests. */
  seed?: number;
};

export type PlanInput = {
  planId: string;
  work: Work;
  edition: TextEdition;
  contentPackId: string;
  languageProfileId: string;
  errorMode: ErrorMode;
  /** Recorded on the plan; the transform itself is applied after buildPlan. */
  textFilterId: TextFilterId;
  selection: PlanSelection;
};

export type GameModeDefinition = GameMode & {
  /** Short, calm description shown in the mode chooser. */
  description: string;
  buildPlan(input: PlanInput): SessionPlan;
};

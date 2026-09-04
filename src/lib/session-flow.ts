/**
 * Glue between URL parameters, preferences, content and the game modes.
 * Pure functions (no React), so the flow is testable.
 */
import {
  defaultEdition,
  firstSegment,
  getEditionById,
  getWork,
  orderedSegments,
} from "@/domain/content/registry";
import { newId } from "@/domain/ids";
import { requireGameMode } from "@/domain/modes/registry";
import { DEFAULT_TIMED_LIMIT_MS, TIMED_LIMIT_OPTIONS_MS } from "@/domain/modes/timed";
import type { SessionPlan } from "@/domain/modes/types";
import {
  runnerResumeSegmentId,
  type RunnerState,
} from "@/domain/session/runner";
import {
  applyTextFilter,
  DEFAULT_TEXT_FILTER_ID,
  isTextFilterId,
  requireTextFilter,
} from "@/domain/text-filter";
import {
  progressKey,
  type ReadingProgress,
  type TextEdition,
  type TextFilterId,
  type UserPreferences,
  type Work,
} from "@/domain/types";

export type SessionParams = {
  mode: string;
  workId: string;
  editionId?: string;
  segmentId?: string;
  limitMs?: number;
  /** Overrides the stored preference for this session only. */
  textFilterId?: TextFilterId;
};

export function parseSessionParams(
  get: (key: string) => string | null,
): SessionParams | null {
  const mode = get("mode");
  const workId = get("work");
  if (!mode || !workId) return null;
  const limitRaw = get("limit");
  const limitMs = limitRaw ? Number(limitRaw) : undefined;
  const filterRaw = get("filter");
  return {
    mode,
    workId,
    editionId: get("edition") ?? undefined,
    segmentId: get("segment") ?? undefined,
    limitMs: limitMs && Number.isFinite(limitMs) && limitMs > 0 ? limitMs : undefined,
    textFilterId: isTextFilterId(filterRaw) ? filterRaw : undefined,
  };
}

export function sessionHref(p: SessionParams): string {
  const q = new URLSearchParams({ mode: p.mode, work: p.workId });
  if (p.editionId) q.set("edition", p.editionId);
  if (p.segmentId) q.set("segment", p.segmentId);
  if (p.limitMs) q.set("limit", String(p.limitMs));
  if (p.textFilterId) q.set("filter", p.textFilterId);
  return `/skriv?${q.toString()}`;
}

export function resolveWorkAndEdition(
  params: Pick<SessionParams, "workId" | "editionId">,
  languageProfileId: string,
): { work: Work; edition: TextEdition } | null {
  const work = getWork(params.workId);
  if (!work) return null;
  const edition =
    (params.editionId ? getEditionById(work, params.editionId) : undefined) ??
    defaultEdition(work, languageProfileId);
  return { work, edition };
}

export function nonstopProgressKey(
  edition: TextEdition,
  work: Work,
  languageProfileId: string,
): string {
  return progressKey({
    languageProfileId,
    editionId: edition.id,
    gameModeId: "nonstop",
    workId: work.id,
  });
}

export function clampTimedLimit(limitMs: number | undefined, fallback?: number): number {
  const wanted = limitMs ?? fallback ?? DEFAULT_TIMED_LIMIT_MS;
  return (TIMED_LIMIT_OPTIONS_MS as readonly number[]).includes(wanted)
    ? wanted
    : DEFAULT_TIMED_LIMIT_MS;
}

/** Build the SessionPlan for a set of params, preferences and (nonstop) progress. */
export function buildPlan(
  params: SessionParams,
  prefs: UserPreferences,
  progress: ReadingProgress | null,
): SessionPlan {
  const mode = requireGameMode(params.mode);
  const resolved = resolveWorkAndEdition(params, prefs.languageProfileId);
  if (!resolved) throw new Error(`Unknown work: ${params.workId}`);
  const { work, edition } = resolved;
  const textFilterId =
    params.textFilterId ?? prefs.textFilterId ?? DEFAULT_TEXT_FILTER_ID;
  const plan = mode.buildPlan({
    planId: newId("p"),
    work,
    edition,
    contentPackId: work.contentPackId,
    languageProfileId: prefs.languageProfileId,
    errorMode: prefs.defaultErrorMode,
    textFilterId,
    selection: {
      segmentId: params.segmentId,
      startSegmentId: progress?.nextSegmentId,
      limitMs:
        mode.id === "timed" ? clampTimedLimit(params.limitMs, prefs.lastTimedLimitMs) : undefined,
    },
  });
  // The game mode picks WHICH segments; the filter transforms their text. The
  // engine only ever sees the finished text, so it stays free of language and
  // practice-form rules.
  const segments = applyTextFilter(plan.segments, textFilterId);
  if (segments.length === 0) {
    throw new Error(
      `Filteret «${requireTextFilter(textFilterId).displayName}» gir ingen tekst å skrive.`,
    );
  }
  return { ...plan, textFilterId, segments };
}

/** Progress record after a nonstop runner state change; null when the work is finished. */
export function progressFromRunner(
  state: RunnerState,
  edition: TextEdition,
  previous: ReadingProgress | null,
  nowIso: string,
): ReadingProgress | null {
  const resume = runnerResumeSegmentId(state);
  if (resume === null) return null;
  const completed = new Set(previous?.completedSegmentIds ?? []);
  for (const id of state.completedSegmentIds) completed.add(id);
  return {
    key: progressKey({
      languageProfileId: state.plan.languageProfileId,
      editionId: edition.id,
      gameModeId: state.plan.gameModeId,
      workId: state.plan.workId,
    }),
    workId: state.plan.workId,
    editionId: edition.id,
    languageProfileId: state.plan.languageProfileId,
    gameModeId: state.plan.gameModeId,
    nextSegmentId: resume,
    completedSegmentIds: [...completed],
    updatedAt: nowIso,
  };
}

/** Preferences updated with the session's last-used choices. */
export function rememberChoice(
  prefs: UserPreferences,
  plan: SessionPlan,
): UserPreferences {
  return {
    ...prefs,
    lastModeId: plan.gameModeId,
    lastContentPackId: plan.contentPackId,
    lastWorkId: plan.workId,
    lastTimedLimitMs:
      plan.endRule.kind === "time" ? plan.endRule.limitMs : prefs.lastTimedLimitMs,
    textFilterId: plan.textFilterId,
  };
}

/** Where "Fortsett" should take the user, from stored preferences. */
export function continueHref(prefs: UserPreferences): string | null {
  if (!prefs.lastModeId || !prefs.lastWorkId) return null;
  if (!getWork(prefs.lastWorkId)) return null;
  switch (prefs.lastModeId) {
    case "nonstop":
      return sessionHref({
        mode: "nonstop",
        workId: prefs.lastWorkId,
        textFilterId: prefs.textFilterId,
      });
    case "timed":
      return sessionHref({
        mode: "timed",
        workId: prefs.lastWorkId,
        limitMs: clampTimedLimit(prefs.lastTimedLimitMs),
        textFilterId: prefs.textFilterId,
      });
    case "passage":
      return `/velg/passage?work=${encodeURIComponent(prefs.lastWorkId)}`;
    default:
      return null;
  }
}

/** The segment after `segmentId` in reading order, if any. */
export function nextSegmentAfter(edition: TextEdition, segmentId: string) {
  const ordered = orderedSegments(edition);
  const i = ordered.findIndex((s) => s.id === segmentId);
  return i === -1 ? firstSegment(edition) : ordered[i + 1];
}

export function editionLabel(edition: TextEdition): string {
  return edition.kind === "training-edition"
    ? `Brand Training Edition ${edition.version}`
    : "Originaltekst";
}

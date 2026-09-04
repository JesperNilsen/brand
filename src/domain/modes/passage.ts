import type { GameModeDefinition, SessionPlan } from "./types";

export const passageMode: GameModeDefinition = {
  id: "passage",
  displayName: "Passasje",
  description: "Velg et avgrenset utdrag og skriv det ferdig.",
  availableInV1: true,
  defaultErrorMode: "flow",
  settingsSchema: {
    segmentId: { type: "string", required: true },
  },
  buildPlan(input): SessionPlan {
    const { edition, selection } = input;
    const segment = selection.segmentId
      ? edition.segments.find((s) => s.id === selection.segmentId)
      : edition.segments[0];
    if (!segment) {
      throw new Error(
        `Passage: segment ${selection.segmentId ?? "(first)"} not found in ${edition.id}`,
      );
    }
    return {
      id: input.planId,
      gameModeId: "passage",
      languageProfileId: input.languageProfileId,
      contentPackId: input.contentPackId,
      workId: input.work.id,
      editionId: edition.id,
      errorMode: input.errorMode,
      textFilterId: input.textFilterId,
      segments: [segment],
      endRule: { kind: "all-segments" },
    };
  },
};

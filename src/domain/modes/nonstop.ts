import type { GameModeDefinition, SessionPlan } from "./types";

export const nonstopMode: GameModeDefinition = {
  id: "nonstop",
  displayName: "Nonstop",
  description:
    "Skriv deg gjennom et verk, segment for segment. Fremdriften lagres, og du fortsetter der du slapp.",
  availableInV1: true,
  defaultErrorMode: "flow",
  settingsSchema: {
    startSegmentId: { type: "string", required: false },
  },
  buildPlan(input): SessionPlan {
    const { edition, selection } = input;
    const ordered = [...edition.segments].sort((a, b) => a.order - b.order);
    let startIndex = 0;
    if (selection.startSegmentId) {
      const i = ordered.findIndex((s) => s.id === selection.startSegmentId);
      startIndex = i === -1 ? 0 : i;
    }
    const segments = ordered.slice(startIndex);
    if (segments.length === 0) {
      throw new Error(`Nonstop: edition ${edition.id} has no segments`);
    }
    return {
      id: input.planId,
      gameModeId: "nonstop",
      languageProfileId: input.languageProfileId,
      contentPackId: input.contentPackId,
      workId: input.work.id,
      editionId: edition.id,
      editionVersion: edition.version,
      editionContentHash: edition.contentHash,
      errorMode: input.errorMode,
      textFilterId: input.textFilterId,
      segments,
      endRule: { kind: "user-stop" },
    };
  },
};

import { drillMode } from "./drill";
import { nonstopMode } from "./nonstop";
import { passageMode } from "./passage";
import { timedMode } from "./timed";
import type { GameModeDefinition } from "./types";

const modes: readonly GameModeDefinition[] = [drillMode, nonstopMode, passageMode, timedMode];

export function listGameModes(): readonly GameModeDefinition[] {
  return modes.filter((m) => m.availableInV1);
}

/**
 * The modes a reader is offered as a choice.
 *
 * Drill is available but not offered here: it has no chooser page, because not
 * having to choose is the whole of it. Naming it in a list of choices would put
 * it exactly where it does not belong — and `listGameModes` still returns it,
 * so a stored session or a "Fortsett" can name it.
 */
export function listChoosableModes(): readonly GameModeDefinition[] {
  return listGameModes().filter((m) => m.hasChooser);
}

export function getGameMode(id: string): GameModeDefinition | undefined {
  return modes.find((m) => m.id === id);
}

export function requireGameMode(id: string): GameModeDefinition {
  const m = getGameMode(id);
  if (!m || !m.availableInV1) throw new Error(`Unknown game mode: ${id}`);
  return m;
}

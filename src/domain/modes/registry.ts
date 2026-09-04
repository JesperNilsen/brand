import { nonstopMode } from "./nonstop";
import { passageMode } from "./passage";
import { timedMode } from "./timed";
import type { GameModeDefinition } from "./types";

const modes: readonly GameModeDefinition[] = [nonstopMode, passageMode, timedMode];

export function listGameModes(): readonly GameModeDefinition[] {
  return modes.filter((m) => m.availableInV1);
}

export function getGameMode(id: string): GameModeDefinition | undefined {
  return modes.find((m) => m.id === id);
}

export function requireGameMode(id: string): GameModeDefinition {
  const m = getGameMode(id);
  if (!m || !m.availableInV1) throw new Error(`Unknown game mode: ${id}`);
  return m;
}

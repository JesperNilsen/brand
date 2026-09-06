/**
 * The pure core of the training-edition builder.
 *
 * It now lives under `src/domain/language/rules/`, because the report half of
 * the same matcher is meant to run in the browser and a module under
 * `scripts/` cannot. This file stays as the specifier every build script and
 * test already imports, so the move changed no call site — and
 * `pnpm validate:content` rebuilding six published editions byte for byte is
 * the proof that it changed no output either.
 */
export {
  applyLowercaseNouns,
  applyRules,
  assertCorpusFamily,
  baseOverrides,
  composeRules,
  isSentenceInitial,
  OPENING_QUOTE,
  SENTENCE_BOUNDARY,
  type BaseRules,
  type RuleFamily,
  type Rules,
} from "../../src/domain/language/rules";

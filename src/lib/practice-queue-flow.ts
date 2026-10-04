import { aggregateMeasured } from "@/domain/engine/practice-focus";
import {
  deriveFromDeviations,
  selectForEdition,
  toDrillItems,
  type QueueItem,
  type StaleItem,
} from "@/domain/practice-queue";
import type { DrillItem, TextEdition } from "@/domain/types";
import type { BrandRepository } from "@/infra/repository/BrandRepository";

/** How many sessions back the derived source looks. */
const MEASURED_SESSION_LIMIT = 20;

/**
 * The pieces a drill session types, drawn from all three of T-12's sources.
 *
 * The merge happens HERE, at the one place that already fetches the bank —
 * not in `drillMode`, which goes on receiving a flat `DrillItem[]` and goes on
 * not knowing where any of it came from. That is the whole of T-12's «one
 * mode, several sources»: the mode is untouched by this file existing.
 *
 * Order is bank first, then the queue. A reader who has marked nothing gets
 * exactly the session they got before.
 */
export async function drillItemsFor(
  repo: BrandRepository,
  edition: TextEdition,
  bank: readonly DrillItem[],
): Promise<{ items: DrillItem[]; queue: QueueItem[]; stale: StaleItem[] }> {
  const stored = await repo.listQueue();

  // Source (b). Topping the queue up at the start of a session rather than at
  // the end of one is deliberate: the pieces are derived from what the reader
  // has actually got wrong so far, and that is a fact about their history, not
  // about the session that just ended.
  const sessions = await repo.listSessions({ limit: MEASURED_SESSION_LIMIT });
  const measured = aggregateMeasured(sessions);
  const topped =
    measured.measured > 0 ? deriveFromDeviations(stored, edition, measured) : stored;

  // Source (c), plus anything source (b) just added: selected for THIS edition
  // and re-checked against it. Stale pieces are dropped from the queue rather
  // than carried forever — they cannot be typed and they cannot be repaired.
  const selection = selectForEdition(topped, edition);
  const live = [...selection.items, ...selection.revalidated];
  const staleIds = new Set(selection.stale.map((s) => s.item.id));
  const kept = topped
    .filter((q) => !staleIds.has(q.id))
    .map((q) => live.find((l) => l.id === q.id) ?? q);
  // Counted against `topped` rather than against `kept.length`: derive adding
  // two pieces while the bump set two aside leaves the length unchanged, and a
  // length comparison would then throw the derived pieces away.
  const changed =
    topped.length !== stored.length || staleIds.size > 0 || selection.revalidated.length > 0;
  if (changed) await repo.saveQueue(kept);

  return {
    items: [...bank, ...toDrillItems(live, bank.length)],
    queue: kept,
    stale: selection.stale,
  };
}

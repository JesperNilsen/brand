/**
 * Modules: the division of a work that carries its own progress.
 *
 * Stricter than `part`, and the strictness is the point. `part` is a free
 * string on the segment; nothing keys on it, so a typo makes a second group and
 * costs nothing. A module id reaches the progress key, so a typo makes a second
 * *place in the book* — a reader's position silently filed under a module that
 * does not exist. These checks exist because that failure is invisible from
 * inside the app: the record is written, the record is read back, and it simply
 * never matches what the chooser asks for.
 *
 * The all-or-nothing rule is the same shape as the one `part` already has: a
 * half-modularised edition would give some segments a module element in the key
 * and others none, which is two keying schemes for one work.
 */

type ModuleSpec = { id?: unknown; title?: unknown; order?: unknown; difficulty?: unknown };
type SegmentSpec = { id?: unknown; moduleId?: unknown };

/**
 * Complain about an edition whose modules contradict its segments.
 *
 * An edition with no modules and no `moduleId` anywhere is silent — that is
 * every work in the catalogue today, and it must stay free.
 */
export function moduleProblems(
  where: string,
  modules: readonly ModuleSpec[] | undefined,
  segments: readonly SegmentSpec[],
): string[] {
  const problems: string[] = [];
  const named = segments.filter((s) => s.moduleId !== undefined && s.moduleId !== "");

  if (!modules || modules.length === 0) {
    if (named.length > 0) {
      problems.push(
        `${where}: ${named.length} segment(er) navngir en moduleId, men utgaven erklærer ingen modules`,
      );
    }
    return problems;
  }

  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const m of modules) {
    const id = typeof m.id === "string" ? m.id : "";
    const at = `${where}: modul «${id || "(uten id)"}»`;
    if (!id) problems.push(`${at} mangler id`);
    else if (ids.has(id)) problems.push(`${at}: id gjentas`);
    ids.add(id);
    if (typeof m.title !== "string" || !m.title.trim()) problems.push(`${at} mangler tittel`);
    if (typeof m.order !== "number" || !Number.isInteger(m.order)) {
      problems.push(`${at}: order må være et helt tall`);
    } else if (orders.has(m.order)) {
      problems.push(`${at}: order ${m.order} gjentas`);
    } else {
      orders.add(m.order);
    }
  }
  // 1..N with no gaps: the order is a reading order, and a gap means a module
  // was removed without the rest being renumbered.
  for (let i = 1; i <= modules.length; i++) {
    if (!orders.has(i)) problems.push(`${where}: modulrekkefølgen mangler ${i} (forventet 1–${modules.length})`);
  }

  // All or nothing. A half-modularised edition keys some segments with a module
  // element and others without — two schemes for one work.
  if (named.length !== segments.length) {
    problems.push(
      `${where}: ${named.length} av ${segments.length} segmenter har moduleId — enten alle eller ingen`,
    );
  }

  for (const s of named) {
    const moduleId = String(s.moduleId);
    if (!ids.has(moduleId)) {
      problems.push(`${where}/${String(s.id)}: moduleId «${moduleId}» er ikke en erklært modul`);
    }
  }

  // Contiguous in reading order, exactly as `part` must be: a module that comes
  // back after another one is not a division of the text, it is two.
  const seen = new Set<string>();
  let current: string | undefined;
  for (const s of segments) {
    const moduleId = s.moduleId === undefined ? undefined : String(s.moduleId);
    if (moduleId === current) continue;
    if (moduleId !== undefined && seen.has(moduleId)) {
      problems.push(
        `${where}: modul «${moduleId}» kommer tilbake etter en annen — modulene må være sammenhengende`,
      );
    }
    if (moduleId !== undefined) seen.add(moduleId);
    current = moduleId;
  }

  for (const id of ids) {
    if (id && !named.some((s) => String(s.moduleId) === id)) {
      problems.push(`${where}: modul «${id}» har ingen segmenter`);
    }
  }

  return problems;
}

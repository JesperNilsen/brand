/**
 * Reading `content/<pack>/review.json`: the record of who read a training
 * edition, and which exact text they read.
 *
 * It is a sibling of the edition rather than a field inside it. A review is a
 * statement ABOUT a frozen edition, and `validate:content` rebuilds every
 * published training edition and byte-compares it, so any field written into
 * the edition file must be produced by the builder. A human's name is not.
 *
 * `reviewedContentHash` is the point of the format. It cannot drift for a
 * genuinely immutable edition, so a mismatch means someone edited a published
 * `rules.vN.json` in place instead of cutting the next version — the exact
 * mistake the immutability rule exists to prevent, and one that is otherwise
 * invisible.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReviewStatus } from "../../src/domain/types";

export type ReviewEntry = {
  reviewStatus: ReviewStatus;
  /** The contentHash this review certifies. */
  reviewedContentHash?: string;
  reviewedBy?: string;
  /** ISO date, YYYY-MM-DD. */
  reviewedAt?: string;
  /** What the reader wants the next reader to know. Not shown in the app. */
  notes?: string[];
};

export type ReviewFile = Record<string, ReviewEntry>;

const STATUSES: ReviewStatus[] = ["unreviewed", "in-review", "reviewed"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The review file for a pack, or an empty record when it has none yet. */
export async function loadReviews(dir: string): Promise<ReviewFile> {
  try {
    const raw = await readFile(path.join(dir, "review.json"), "utf8");
    return JSON.parse(raw) as ReviewFile;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}

/**
 * Complain about a review file that contradicts itself or the editions it
 * describes. Absence is not a contradiction and is not reported here — that
 * is a policy question, and it belongs to the validator.
 */
export function reviewProblems(
  pack: string,
  reviews: ReviewFile,
  editions: readonly { id: string; kind: string; contentHash: string }[],
): string[] {
  const problems: string[] = [];
  const byId = new Map(editions.map((e) => [e.id, e]));

  for (const [id, entry] of Object.entries(reviews)) {
    const where = `${pack}/review.json ${id}`;
    const edition = byId.get(id);
    if (!edition) {
      problems.push(`${where}: no such edition in this pack`);
      continue;
    }
    if (edition.kind !== "training-edition") {
      problems.push(`${where}: only a training edition is reviewed, not a ${edition.kind}`);
    }
    if (!STATUSES.includes(entry.reviewStatus)) {
      problems.push(`${where}: reviewStatus must be one of ${STATUSES.join(", ")}`);
    }
    if (entry.reviewedContentHash && entry.reviewedContentHash !== edition.contentHash) {
      problems.push(
        `${where}: reviewedContentHash is ${entry.reviewedContentHash} but the edition hashes ` +
          `to ${edition.contentHash}. A published edition's text cannot change — someone edited ` +
          `its rules in place instead of cutting the next version. The review is void either way.`,
      );
    }
    if (entry.reviewStatus === "reviewed") {
      if (!entry.reviewedBy) problems.push(`${where}: reviewed, but reviewedBy is missing`);
      if (!entry.reviewedAt) problems.push(`${where}: reviewed, but reviewedAt is missing`);
      if (!entry.reviewedContentHash) {
        problems.push(`${where}: reviewed, but reviewedContentHash is missing — a review that ` +
          `does not name the text it certifies cannot be checked later`);
      }
    }
    if (entry.reviewedAt && !ISO_DATE.test(entry.reviewedAt)) {
      problems.push(`${where}: reviewedAt must be YYYY-MM-DD, got ${entry.reviewedAt}`);
    }
  }
  return problems;
}

/** The three fields the catalog carries. The hash and notes stay out of the app. */
export function publishedReviewFields(
  entry: ReviewEntry | undefined,
): Partial<Pick<ReviewEntry, "reviewStatus" | "reviewedBy" | "reviewedAt">> {
  if (!entry) return {};
  const out: Partial<Pick<ReviewEntry, "reviewStatus" | "reviewedBy" | "reviewedAt">> = {
    reviewStatus: entry.reviewStatus,
  };
  if (entry.reviewedBy) out.reviewedBy = entry.reviewedBy;
  if (entry.reviewedAt) out.reviewedAt = entry.reviewedAt;
  return out;
}

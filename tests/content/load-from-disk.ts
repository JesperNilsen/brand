/**
 * Loads a built edition asset from `public/` in a Node test, through the real
 * loader. Tests that need text therefore exercise the same id, hash and
 * content checks the browser performs, against the files actually shipped.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEditionText } from "@/domain/content/edition-loader";
import type { TextEdition, TextEditionMeta } from "@/domain/types";

/** Serves `/content/...` out of `public/content/...`. */
export const fetchFromPublic = async (url: string) => {
  const file = path.resolve(process.cwd(), "public", url.replace(/^\//, ""));
  try {
    const raw = await readFile(file, "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(raw) };
  } catch {
    return {
      ok: false,
      status: 404,
      json: async () => {
        throw new Error("not found");
      },
    };
  }
};

export function loadFromDisk(meta: TextEditionMeta): Promise<TextEdition> {
  return loadEditionText(meta, fetchFromPublic);
}

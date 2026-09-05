"use client";

import { useRef, useState } from "react";
import { getRepository } from "@/infra/repository";
import {
  ImportError,
  exportData,
  exportFileName,
  importData,
  serializeExport,
} from "@/lib/data-transfer";

/**
 * Download everything, and read it back.
 *
 * Placed at the foot of the history page rather than in a settings screen: it
 * is about the records above it, and this is where a reader who cares about
 * losing them is already standing.
 */
export function DataTransfer({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function download() {
    setStatus(null);
    setFailed(false);
    try {
      const text = serializeExport(await exportData(getRepository()));
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName();
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Filen er lastet ned.");
    } catch {
      setFailed(true);
      setStatus("Kunne ikke lage filen.");
    }
  }

  async function read(file: File) {
    setStatus(null);
    setFailed(false);
    try {
      const report = await importData(getRepository(), JSON.parse(await file.text()));
      const parts = [
        `${report.sessionsImported} økter lest inn`,
        report.progressImported > 0 ? `${report.progressImported} fremdriftspunkt` : null,
        report.sessionsSkipped > 0 ? `${report.sessionsSkipped} kunne ikke leses` : null,
      ].filter(Boolean);
      setStatus(`${parts.join(", ")}.`);
      onImported();
    } catch (e) {
      setFailed(true);
      setStatus(
        e instanceof ImportError ? e.message : "Filen kunne ikke leses som JSON.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="prose-measure mt-12 border-t border-rule pt-6" aria-labelledby="data-heading">
      <h2 id="data-heading" className="label mb-2">
        Dine data
      </h2>
      <p className="mb-4 text-sm text-ink-muted">
        Alt ligger i denne nettleseren. Tømmer du nettleserlageret, er historikken borte.
        Last den ned nå og da, og les den inn igjen om du bytter maskin.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={download} data-testid="export-button">
          Last ned alle data
        </button>
        <label className="btn cursor-pointer">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            data-testid="import-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void read(f);
            }}
          />
          Les inn fra fil
        </label>
      </div>
      {status && (
        <p
          className={`mt-3 text-sm ${failed ? "text-error" : "text-ink-muted"}`}
          role="status"
          data-testid="transfer-status"
        >
          {status}
        </p>
      )}
    </section>
  );
}

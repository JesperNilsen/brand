"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  getOrthography,
  implementationStatusLabel,
  listWritingLanguages,
  orthographyFor,
  periodLabel,
  requireOrthography,
  type OfficialStatus,
  type WritingLanguage,
  type WritingLanguageId,
} from "@/domain/orthography";
import { useWritingNorm } from "@/hooks/useWritingNorm";

const OFFICIAL_SHORT: Record<OfficialStatus, string> = {
  "current-official": "gjeldende",
  "historical-official": "historisk",
  house: "husnorm",
};

/** Eight teeth, drawn here rather than imported: the app has no icon set. */
const GEAR_PATH =
  "M19.30 9.25 L22.00 9.97 L22.00 14.03 L19.30 14.75 L19.10 15.22 L20.50 17.64 L17.64 20.50 L15.22 19.10 L14.75 19.30 L14.03 22.00 L9.97 22.00 L9.25 19.30 L8.78 19.10 L6.36 20.50 L3.50 17.64 L4.90 15.22 L4.70 14.75 L2.00 14.03 L2.00 9.97 L4.70 9.25 L4.90 8.78 L3.50 6.36 L6.36 3.50 L8.78 4.90 L9.25 4.70 L9.97 2.00 L14.03 2.00 L14.75 4.70 L15.22 4.90 L17.64 3.50 L20.50 6.36 L19.10 8.78 Z";

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d={GEAR_PATH} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The language menu in the header (D21).
 *
 * The main list holds languages only. A language with more than one norm gets
 * a gear beside it; the gear opens that language's norms in the same panel,
 * so the historical norms never crowd the list. Choosing the language itself
 * keeps whatever norm it was last on.
 *
 * Native radios, not a hand-built listbox: arrow keys, the checked state and
 * the screen-reader announcement come with them.
 */
export function LanguageMenu() {
  const norm = useWritingNorm();
  const [open, setOpen] = useState(false);
  const [normsFor, setNormsFor] = useState<WritingLanguageId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const selected = requireOrthography(norm.orthographyId);
  const language = listWritingLanguages().find((l) => l.id === norm.languageId)!;
  // The trigger names the language, and the norm only when it is not the
  // language's default: «Bokmål», but «Bokmål 1938».
  const triggerLabel =
    selected.id === language.defaultOrthographyId ? language.displayName : selected.displayName;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setNormsFor(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      setNormsFor(null);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setNormsFor(null);
  }

  return (
    // Positioned against the header below 640px, where the trigger is not at
    // the right edge and a panel anchored to it would leave the screen.
    <div className="sm:relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="control text-sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        data-testid="language-menu-trigger"
      >
        <span className="sr-only">Språk: </span>
        {triggerLabel}
        <span aria-hidden="true" className="ml-1.5 text-ink-muted">
          ▾
        </span>
      </button>
      {open && (
        <div id={panelId} className="lang-menu" data-testid="language-menu">
          {normsFor ? (
            <NormList
              language={listWritingLanguages().find((l) => l.id === normsFor)!}
              checkedId={orthographyFor(normsFor, norm.remembered)}
              onBack={() => setNormsFor(null)}
              onChoose={(id) => {
                norm.chooseOrthography(normsFor, id);
                setNormsFor(null);
              }}
            />
          ) : (
            <LanguageList
              selectedId={norm.languageId}
              remembered={norm.remembered}
              onChoose={norm.chooseLanguage}
              onOpenNorms={setNormsFor}
              onNavigate={close}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LanguageList(props: {
  selectedId: WritingLanguageId;
  remembered: Readonly<Record<string, string>>;
  onChoose: (id: WritingLanguageId) => void;
  onOpenNorms: (id: WritingLanguageId) => void;
  onNavigate: () => void;
}) {
  return (
    <>
      <fieldset>
        <legend className="label mb-2">Språk</legend>
        <ul className="grid gap-1">
          {listWritingLanguages().map((l) => {
            const hasNorms = l.orthographyIds.length > 1;
            const current = getOrthography(orthographyFor(l.id, props.remembered));
            return (
              <li key={l.id} className="lang-row">
                <label className="lang-option" data-testid={`language-option-${l.id}`}>
                  <input
                    type="radio"
                    name="writing-language"
                    className="sr-only"
                    value={l.id}
                    checked={props.selectedId === l.id}
                    onChange={() => props.onChoose(l.id)}
                  />
                  <span className="block">{l.displayName}</span>
                  {hasNorms && current && (
                    <span className="block text-sm text-ink-muted">{current.displayName}</span>
                  )}
                </label>
                {hasNorms && (
                  <button
                    type="button"
                    className="lang-gear"
                    aria-label={`Velg ${l.displayName.toLowerCase()}snorm`}
                    title={`Velg ${l.displayName.toLowerCase()}snorm`}
                    onClick={() => props.onOpenNorms(l.id)}
                    data-testid={`language-norms-${l.id}`}
                  >
                    <GearIcon />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
      <p className="mt-3 border-t border-rule pt-3 text-sm">
        <Link href="/rettskrivning" className="underline" onClick={props.onNavigate}>
          Øv på rettskrivning
        </Link>
      </p>
    </>
  );
}

function NormList(props: {
  language: WritingLanguage;
  checkedId: string;
  onBack: () => void;
  onChoose: (id: string) => void;
}) {
  const checkedRef = useRef<HTMLInputElement>(null);
  // Focus follows the reader into the submenu, onto the norm in force, so the
  // arrow keys move from where they are rather than from the top.
  useEffect(() => {
    checkedRef.current?.focus();
  }, []);

  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-baseline gap-2">
        <button
          type="button"
          className="label underline"
          onClick={props.onBack}
          data-testid="language-norms-back"
        >
          ← Språk
        </button>
        <span className="label">{props.language.displayName}snorm</span>
      </legend>
      <ul className="grid gap-1" data-testid={`norm-list-${props.language.id}`}>
        {props.language.orthographyIds.map((id) => {
          const o = requireOrthography(id);
          return (
            <li key={id}>
              <label className="lang-option" data-testid={`norm-option-${id}`}>
                <input
                  ref={id === props.checkedId ? checkedRef : undefined}
                  type="radio"
                  name={`${props.language.id}-norm`}
                  className="sr-only"
                  value={id}
                  checked={id === props.checkedId}
                  onChange={() => props.onChoose(id)}
                />
                <span className="block">{o.displayName}</span>
                <span className="block text-sm text-ink-muted">
                  {periodLabel(o)} · {OFFICIAL_SHORT[o.officialStatus]} ·{" "}
                  {implementationStatusLabel(o.implementationStatus).toLowerCase()}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

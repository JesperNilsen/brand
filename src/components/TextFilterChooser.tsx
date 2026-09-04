"use client";

import { listTextFilters } from "@/domain/text-filter";
import type { TextFilterId } from "@/domain/types";

type Props = {
  value: TextFilterId;
  onChange: (value: TextFilterId) => void;
};

/**
 * Practice-form chooser. Presented as a quiet fieldset rather than a toggle
 * row: the three levels are a reading choice, not a game setting.
 */
export function TextFilterChooser({ value, onChange }: Props) {
  const active = listTextFilters().find((f) => f.id === value);
  return (
    <fieldset className="mb-8">
      <legend className="label mb-3">Tekstform</legend>
      <div className="flex flex-wrap gap-3">
        {listTextFilters().map((f) => (
          <label
            key={f.id}
            className="btn cursor-pointer"
          >
            <input
              type="radio"
              name="textFilter"
              value={f.id}
              checked={value === f.id}
              onChange={() => onChange(f.id)}
              className="sr-only"
            />
            {f.displayName}
          </label>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-muted">{active?.description}</p>
    </fieldset>
  );
}

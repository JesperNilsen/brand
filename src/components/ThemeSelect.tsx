"use client";

import type { ThemePreference } from "@/domain/types";
import { useTheme } from "./ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Lys" },
  { value: "dark", label: "Mørk" },
];

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  return (
    <label className="flex items-baseline gap-2">
      <span className="sr-only">Fargetema</span>
      <select
        className="control text-sm"
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemePreference)}
        aria-label="Fargetema"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

"use client";

import { useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";

export const themes = ["retro", "brownie", "modern"] as const;
export type Theme = (typeof themes)[number];

const storageKey = "theme";

function isTheme(value: string | null): value is Theme {
  return themes.includes(value as Theme);
}

export function ThemeSelector() {
  const t = useTranslations("Theme");
  const [theme, setTheme] = useState<Theme>("retro");

  useLayoutEffect(() => {
    const stored = localStorage.getItem(storageKey);
    const current = isTheme(stored) ? stored : "retro";
    document.documentElement.dataset.theme = current;
    setTheme(current);
  }, []);

  function changeTheme(nextTheme: Theme) {
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(storageKey, nextTheme);
    setTheme(nextTheme);
  }

  return (
    <label className="flex items-center gap-2">
      <span>{t("label")}</span>
      <select
        className="rounded-md border border-input bg-field px-2 py-1 text-field-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => changeTheme(event.target.value as Theme)}
        value={theme}
      >
        {themes.map((value) => (
          <option key={value} value={value}>
            {t(value)}
          </option>
        ))}
      </select>
    </label>
  );
}

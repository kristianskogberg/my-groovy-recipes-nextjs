"use client";

import { useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Contrast, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const themes = ["retro", "brownie", "modern"] as const;
export type Theme = (typeof themes)[number];

const storageKey = "theme";
const themeIcons: Record<Theme, LucideIcon> = {
  retro: Sun,
  brownie: Moon,
  modern: Contrast,
};

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
    <div
      aria-label={t("label")}
      className="flex items-center gap-1"
      role="group"
    >
      {themes.map((value) => {
        const Icon = themeIcons[value];

        return (
          <button
            aria-label={t(value)}
            aria-pressed={theme === value}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              theme === value && "bg-secondary text-accent-secondary",
            )}
            key={value}
            onClick={() => changeTheme(value)}
            title={t(value)}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

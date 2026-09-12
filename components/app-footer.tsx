import { Suspense } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSelector } from "@/components/theme-selector";

export function AppFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 mt-6 border-t p-4 text-sm sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Suspense fallback={null}>
          <LanguageSwitcher />
        </Suspense>
      </div>
      <ThemeSelector />
      <p className="text-muted-foreground">© Kristian Skogberg</p>
    </footer>
  );
}

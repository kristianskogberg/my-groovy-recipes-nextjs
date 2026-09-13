import { Suspense } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSelector } from "@/components/theme-selector";
import { cn } from "@/lib/utils";

export function AppFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mt-6 flex flex-wrap items-center justify-between gap-4 border-t p-4 text-sm sm:p-6",
        className,
      )}
    >
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

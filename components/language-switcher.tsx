"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("Language");

  return (
    <nav aria-label={t("label")} className="flex gap-3 text-sm">
      {(["en", "fi"] as const).map((value) => (
        <Link
          className={locale === value ? "font-bold underline" : "opacity-60"}
          href={pathname}
          key={value}
          locale={value}
        >
          {t(value === "en" ? "english" : "finnish")}
        </Link>
      ))}
    </nav>
  );
}

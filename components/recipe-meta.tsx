"use client";

import { Clock, Flame, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function RecipeMeta({
  calories,
  className,
  servings,
  timeMinutes,
}: {
  calories: number | null;
  className?: string;
  servings: number | string;
  timeMinutes: number | null;
}) {
  const t = useTranslations("Recipe");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <UserRound aria-hidden="true" className="size-4" />
        {t("servingsValue", { count: servings })}
      </span>
      {timeMinutes !== null && (
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-4" />
          {t("minutes", { count: timeMinutes })}
        </span>
      )}
      {calories !== null && (
        <span className="inline-flex items-center gap-1.5">
          <Flame aria-hidden="true" className="size-4" />
          {t("caloriesValue", { count: calories })}
        </span>
      )}
    </div>
  );
}

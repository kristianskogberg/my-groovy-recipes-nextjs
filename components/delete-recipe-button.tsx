"use client";

import { Button } from "@/components/ui/button";
import { useRecipeSaves } from "@/components/recipe-save-provider";
import type { RecipeCard } from "@/lib/recipes/types";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteRecipeButton({ recipe }: { recipe: RecipeCard }) {
  const t = useTranslations("Recipe");
  const locale = useLocale();
  const router = useRouter();
  const { operations, deletions, enqueueDelete } = useRecipeSaves();
  const isDeleting = deletions.some(operation => operation.recipe.id === recipe.id && operation.status !== "failed");
  const isSaving = operations.some(operation => operation.recipe.id === recipe.id && operation.status === "saving");

  function handleDelete() {
    if (!window.confirm(t("deleteConfirm"))) return;
    if (enqueueDelete(recipe)) router.push(`/${locale}`);
  }

  return (
    <Button disabled={isDeleting || isSaving} icon={<Trash2 />} onClick={handleDelete} type="button" variant="destructive">
      {isDeleting ? t("deleting") : t("delete")}
    </Button>
  );
}

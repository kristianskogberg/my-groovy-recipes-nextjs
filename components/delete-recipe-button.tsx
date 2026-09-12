"use client";

import { Button } from "@/components/ui/button";
import { deleteRecipe } from "@/lib/recipes/actions";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

export function DeleteRecipeButton({ id }: { id: string }) {
  const t = useTranslations("Recipe");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(t("deleteConfirm"))) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteRecipe(id, locale);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="grid justify-items-end gap-1">
      <Button
        disabled={isDeleting}
        onClick={handleDelete}
        type="button"
        variant="destructive"
      >
        {isDeleting ? t("deleting") : t("delete")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

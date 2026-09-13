"use client";

import { Button } from "@/components/ui/button";
import { useRecipeMutations } from "@/components/recipe-mutation-provider";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useEffect } from "react";

/** Confirm deletion and show the shared operation state for this recipe. */
export function DeleteRecipeButton({ id }: { id: string }) {
  const t = useTranslations("Recipe");
  const locale = useLocale();
  const { remove, isPending } = useRecipeMutations();
  const isDeleting = isPending(id);
  const router = useRouter();
  useEffect(() => { router.prefetch(`/${locale}`); }, [router, locale]);

  /** Start an optimistic delete only after confirmation and while the recipe is idle. */
  function handleDelete() {
    if (isDeleting || !window.confirm(t("deleteConfirm"))) return;
    remove(id);
  }

  return (
    <div className="grid justify-items-end gap-1">
      <Button
        disabled={isDeleting}
        icon={<Trash2 />}
        onClick={handleDelete}
        type="button"
        variant="destructive"
      >
        {isDeleting ? t("deleting") : t("delete")}
      </Button>
    </div>
  );
}

import { CreateRecipeForm } from "@/components/create-recipe-form";
import { getPresetRecipeImages } from "@/lib/recipes/presets";
import { getRecipe } from "@/lib/recipes/queries";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export default function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
      <EditRecipeContent params={params} />
    </Suspense>
  );
}

async function EditRecipeContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Recipe");
  const [recipe, presetImages] = await Promise.all([
    getRecipe(id),
    getPresetRecipeImages(),
  ]);

  if (!recipe) notFound();

  return (
    <section>
      <h1 className="text-2xl font-bold">{t("editTitle")}</h1>
      <CreateRecipeForm presetImages={presetImages} recipe={recipe} />
    </section>
  );
}

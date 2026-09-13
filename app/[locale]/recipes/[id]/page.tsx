import { RecipeDetail } from "@/components/recipe-detail";
import { CreateRecipeForm } from "@/components/create-recipe-form";
import { getPresetRecipeImages } from "@/lib/recipes/presets";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

// Prefetch the route shell without fetching uncached server data such as auth.
export const prefetch = "partial";

export default function RecipeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}
    >
      <RecipeContent params={params} />
    </Suspense>
  );
}

async function RecipeContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === "new") {
    const t = await getTranslations("Recipe");
    const presetImages = await getPresetRecipeImages();

    return (
      <section>
        <h1 className="text-2xl font-bold">{t("createTitle")}</h1>
        <CreateRecipeForm presetImages={presetImages} />
      </section>
    );
  }

  return <RecipeDetail key={id} id={id} />;
}

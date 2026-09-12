import { CreateRecipeForm } from "@/components/create-recipe-form";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/ui/tag";
import { getPresetRecipeImages } from "@/lib/recipes/presets";
import { getRecipe } from "@/lib/recipes/queries";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export default function RecipeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
      <RecipeContent params={params} />
    </Suspense>
  );
}

async function RecipeContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Recipe");

  if (id === "new") {
    const presetImages = await getPresetRecipeImages();

    return (
      <section>
        <h1 className="text-2xl font-bold">{t("createTitle")}</h1>
        <CreateRecipeForm presetImages={presetImages} />
      </section>
    );
  }

  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  return (
    <article className="grid gap-6">
      {recipe.image_source === "preset" && recipe.image_value && (
        <Image
          alt={recipe.name}
          className="aspect-video w-full rounded-lg object-cover"
          height={400}
          priority
          src={recipe.image_value}
          width={700}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">{recipe.name}</h1>
        <div className="flex gap-2">
          <Button asChild icon={<Pencil />}>
            <Link href={`/recipes/${recipe.id}/edit`}>{t("edit")}</Link>
          </Button>
          <DeleteRecipeButton id={recipe.id} />
        </div>
      </div>

      {recipe.description && <p>{recipe.description}</p>}

      <p>
        {t("servingsValue", { count: recipe.servings })}
        {recipe.time_minutes !== null &&
          ` / ${t("minutes", { count: recipe.time_minutes })}`}
        {recipe.calories_per_serving !== null &&
          ` / ${t("caloriesValue", { count: recipe.calories_per_serving })}`}
      </p>

      {recipe.ingredients.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">{t("ingredients")}</h2>
          <ul className="mt-2 list-disc pl-5">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={`${ingredient}-${index}`}>{ingredient}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">{t("steps")}</h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {recipe.steps.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      {recipe.tags.length > 0 && <TagList tags={recipe.tags} />}
    </article>
  );
}

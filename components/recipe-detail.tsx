"use client";

import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { RecipeMeta } from "@/components/recipe-meta";
import { RecipeSteps } from "@/components/recipe-steps";
import { Button } from "@/components/ui/button";
import { TagList } from "@/components/ui/tag";
import { useRecipeMutations } from "@/components/recipe-mutation-provider";
import { loadRecipe } from "@/lib/recipes/load-recipe";
import type { Recipe } from "@/lib/recipes/types";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

/** Reuse list data; only direct visits without cached data need a request. */
export function RecipeDetail({ id }: { id: string }) {
  const { accountVersion } = useRecipeMutations();
  return <RecipeDetailContent key={`${accountVersion}:${id}`} id={id} />;
}

function RecipeDetailContent({ id }: { id: string }) {
  const { cachedRecipes, mutations } = useRecipeMutations();
  const saved = [...mutations].reverse().find(item => item.status === "saved" && item.recipe?.id === id)?.recipe;
  const cached = saved ?? cachedRecipes[id];
  const [result, setResult] = useState<{ recipe: Recipe | null } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const t = useTranslations("Recipe");

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    void loadRecipe(id).then(recipe => {
      if (!cancelled) setResult({ recipe });
    }).catch(error => {
      if (!cancelled) setError(error instanceof Error ? error : new Error("Could not load recipe"));
    });
    return () => { cancelled = true; };
  }, [id, cached]);

  if (!cached && error) throw error;
  if (!cached && !result) return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  const recipe = cached ?? result?.recipe;
  if (!recipe) notFound();

  return (
    <article className="grid gap-6">
      {recipe.image_url && (
        <Image
          alt={recipe.name}
          className="aspect-video w-full rounded-lg object-cover"
          height={400}
          priority
          sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 768px) calc(100vw - 48px), 720px"
          src={recipe.image_url}
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

      <RecipeMeta
        calories={recipe.calories_per_serving}
        servings={recipe.servings}
        timeMinutes={recipe.time_minutes}
      />

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
        <RecipeSteps steps={recipe.steps} title={t("steps")} />
      )}

      {recipe.tags.length > 0 && <TagList tags={recipe.tags} />}
    </article>
  );
}

"use client";

import { useEffect } from "react";
import { useRecipeSaves } from "@/components/recipe-save-provider";
import { mergeRecipeCards } from "@/lib/recipes/optimistic";
import type { RecipeCard } from "@/lib/recipes/types";
import { RecipeMeta } from "@/components/recipe-meta";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { TagList } from "@/components/ui/tag";

const emptyRecipes: RecipeCard[] = [];

export function RecipeListClient({ recipes = emptyRecipes, loading = false }: { recipes?: RecipeCard[]; loading?: boolean }) {
  const home = useTranslations("Home");
  const t = useTranslations("Recipe");
  const { operations, deletions, reconcile } = useRecipeSaves();
  useEffect(() => { if (!loading) reconcile(recipes); }, [recipes, operations, deletions, reconcile, loading]);
  const rows = mergeRecipeCards(recipes, operations, deletions);
  if (!rows.length) return <p>{home(loading ? "loading" : "empty")}</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ recipe, pending }) => {
        const content = <>
          {recipe.image_url && (
            <Image
              alt={recipe.name}
              className="mb-4 aspect-video w-full rounded-md object-cover"
              height={180}
              src={recipe.image_url}
              unoptimized={recipe.image_url.startsWith("blob:")}
              width={320}
            />
          )}
          <h3 className="text-lg font-semibold">{recipe.name}</h3>
          {recipe.description && (
            <p className="mt-1 text-sm">{recipe.description}</p>
          )}

          <RecipeMeta
            calories={recipe.calories_per_serving}
            className="mt-3"
            servings={recipe.servings}
            timeMinutes={recipe.time_minutes}
          />

          {recipe.tags.length > 0 && (
            <TagList className="mt-3" tags={recipe.tags} />
          )}
          {pending && <p className="mt-3 text-sm text-muted-foreground" role="status">{t("saving")}</p>}
        </>;
        const className = "rounded-lg border border-foreground/20 p-4 transition-colors hover:bg-foreground/5";
        return pending ? <div className={className} key={recipe.id} aria-busy="true">{content}</div> :
          <Link className={className} href={`/recipes/${recipe.id}`} key={recipe.id}>{content}</Link>;
      })}
    </div>
  );
}

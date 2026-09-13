"use client";

import { useEffect } from "react";
import { useRecipeMutations } from "@/components/recipe-mutation-provider";
import { overlayRecipes } from "@/lib/recipes/optimistic";
import type { Recipe } from "@/lib/recipes/types";
import { RecipeMeta } from "@/components/recipe-meta";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { TagList } from "@/components/ui/tag";

/** Display server cards with local changes, then acknowledge matching saved results. */
export function RecipeList({ recipes: serverRecipes }: { recipes: Recipe[] }) {
  const { mutations, reconcile, rememberRecipes } = useRecipeMutations();
  const recipes = overlayRecipes(serverRecipes, mutations);
  const home = useTranslations("Home");
  const t = useTranslations("Recipe");
  useEffect(() => {
    rememberRecipes(serverRecipes);
  }, [serverRecipes, rememberRecipes]);
  useEffect(() => {
    reconcile(serverRecipes);
  }, [serverRecipes, mutations, reconcile]);
  if (!recipes.length) return <p>{home("empty")}</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => {
        const pending = mutations.some(
          (item) => item.recipe?.id === recipe.id && item.status === "pending",
        );
        const content = (
          <>
            {pending && (
              <p className="mb-2 text-sm text-muted-foreground" role="status">
                {t("saving")}
              </p>
            )}

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
          </>
        );
        const className =
          "rounded-lg border border-foreground/20 p-4 transition-colors bg-card hover:bg-foreground/5";
        return pending ? (
          <div aria-busy="true" className={className} key={recipe.id}>
            {content}
          </div>
        ) : (
          <Link
            className={className}
            href={`/recipes/${recipe.id}`}
            key={recipe.id}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}

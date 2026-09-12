import { getRecipes } from "@/lib/recipes/queries";
import { RecipeMeta } from "@/components/recipe-meta";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { TagList } from "@/components/ui/tag";

export async function RecipeList() {
  const recipes = await getRecipes();
  const home = await getTranslations("Home");
  if (!recipes.length) return <p>{home("empty")}</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => (
        <Link
          className="rounded-lg border border-foreground/20 p-4 transition-colors hover:bg-foreground/5"
          href={`/recipes/${recipe.id}`}
          key={recipe.id}
        >
          {recipe.image_url && (
            <Image
              alt={recipe.name}
              className="mb-4 aspect-video w-full rounded-md object-cover"
              height={180}
              src={recipe.image_url}
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
        </Link>
      ))}
    </div>
  );
}

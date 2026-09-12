import { getRecipes } from "@/lib/recipes/queries";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { TagList } from "@/components/ui/tag";

export async function RecipeList() {
  const recipes = await getRecipes();
  const home = await getTranslations("Home");
  const t = await getTranslations("Recipe");
  if (!recipes.length) return <p>{home("empty")}</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => (
        <Link
          className="rounded-lg border border-foreground/20 p-4 transition-colors hover:bg-foreground/5"
          href={`/recipes/${recipe.id}`}
          key={recipe.id}
        >
          {recipe.image_source === "preset" && recipe.image_value && (
            <Image
              alt=""
              className="mb-4 aspect-video w-full rounded-md object-cover"
              height={180}
              src={recipe.image_value}
              width={320}
            />
          )}
          <h3 className="text-lg font-semibold">{recipe.name}</h3>
          {recipe.description && <p className="mt-1 text-sm">{recipe.description}</p>}

          <p className="mt-3 text-sm">
            {t("servingsValue", { count: recipe.servings })}
            {recipe.time_minutes !== null &&
              ` / ${t("minutes", { count: recipe.time_minutes })}`}
            {recipe.calories_per_serving !== null &&
              ` / ${t("caloriesValue", { count: recipe.calories_per_serving })}`}
          </p>

          {recipe.tags.length > 0 && (
            <TagList className="mt-3" tags={recipe.tags} />
          )}
        </Link>
      ))}
    </div>
  );
}

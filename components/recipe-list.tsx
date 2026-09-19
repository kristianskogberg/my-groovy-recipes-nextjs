import { getRecipes } from "@/lib/recipes/queries";
import { RecipeListClient } from "@/components/recipe-list-client";

export async function RecipeList() {
  return <RecipeListClient recipes={await getRecipes()} />;
}

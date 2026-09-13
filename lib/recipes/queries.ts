import type { Recipe } from "@/lib/recipes/types";
import { getUploadedRecipeImageUrl } from "@/lib/recipes/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Fetch the current user's ID.
 * @returns The user's ID, or null if not found.
 */
async function getUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error) throw new Error(`Could not verify user: ${error.message}`);

  return { supabase, userId: data?.claims?.sub };
}

function withImageUrl<T extends { image_source: string | null; image_value: string | null }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipe: T,
) {
  return {
    ...recipe,
    image_url:
      recipe.image_source === "upload" && recipe.image_value
        ? getUploadedRecipeImageUrl(supabase.storage, recipe.image_value)
        : recipe.image_value,
  };
}

/**
 * Fetch recipes for the current user.
 * Include detail fields so card navigation can reuse the loaded recipes.
 */
export async function getRecipes() {
  const { supabase, userId } = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, name, description, servings, time_minutes, calories_per_serving, image_source, image_value, ingredients, steps, tags",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load recipes: ${error.message}`);
  return data.map((recipe) => withImageUrl(supabase, recipe)) as Recipe[];
}

/**
 * Fetch a single recipe by its ID for the current user.
 * @param id - The ID of the recipe to fetch.
 * @returns The Recipe object, or null if not found.
 */
export async function getRecipe(id: string) {
  const { supabase, userId } = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, name, description, servings, time_minutes, calories_per_serving, image_source, image_value, ingredients, steps, tags",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Could not load recipe: ${error.message}`);
  return data ? (withImageUrl(supabase, data) as Recipe) : null;
}

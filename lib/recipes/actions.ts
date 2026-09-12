"use server";

import { getPresetRecipeImages } from "@/lib/recipes/presets";
import type { RecipeActionState } from "@/lib/recipes/types";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const lines = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

function optionalNumber(value: FormDataEntryValue | null) {
  return value === null || value === "" ? null : Number(value);
}

/**
 * Save recipe or update existing recipe.
 * @param recipeId ID of the recipe to update, or null to create a new recipe.
 * @param _state The current state of the recipe.
 * @param data FormData object containing the recipe data to save.
 * @returns A Promise that resolves to the updated RecipeActionState.
 */
export async function saveRecipe(
  recipeId: string | null,
  _state: RecipeActionState,
  data: FormData,
): Promise<RecipeActionState> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return { error: "You must be signed in to save a recipe." };
  }

  const name = String(data.get("name") ?? "").trim();
  const servings = Number(data.get("servings"));
  const timeMinutes = optionalNumber(data.get("time_minutes"));
  const calories = optionalNumber(data.get("calories_per_serving"));

  if (!name || !Number.isFinite(servings) || servings <= 0) {
    return { error: "Name and a valid serving amount are required." };
  }

  if (
    (timeMinutes !== null &&
      (!Number.isInteger(timeMinutes) || timeMinutes < 0)) ||
    (calories !== null && (!Number.isInteger(calories) || calories < 0))
  ) {
    return { error: "Time and calories must be positive whole numbers." };
  }

  const presetRecipeImages = await getPresetRecipeImages();
  const selectedImage = String(data.get("image_value") ?? "");
  const imageValue = presetRecipeImages.some(
    (image) => image.value === selectedImage,
  )
    ? selectedImage
    : null;

  const values = {
    name,
    description: String(data.get("description") ?? "").trim() || null,
    servings,
    time_minutes: timeMinutes,
    calories_per_serving: calories,
    image_source: imageValue ? "preset" : null,
    image_value: imageValue,
    ingredients: lines(data.get("ingredients")),
    steps: lines(data.get("steps")),
    tags: String(data.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };

  const { data: savedRecipe, error } = recipeId
    ? await supabase
        .from("recipes")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", recipeId)
        .eq("user_id", auth.user.id)
        .select("id")
        .single()
    : await supabase
        .from("recipes")
        .insert({ ...values, user_id: auth.user.id })
        .select("id")
        .single();

  if (error || !savedRecipe) {
    return { error: error?.message ?? "Recipe could not be saved." };
  }

  revalidatePath("/");
  if (recipeId) revalidatePath(`/recipes/${recipeId}`);
  redirect(recipeId ? `/recipes/${recipeId}` : "/");
}

/**
 * Delete a recipe by its ID.
 * @param id ID of the recipe to delete.
 * @returns A Promise that resolves to the updated RecipeActionState.
 */
export async function deleteRecipe(id: string): Promise<RecipeActionState> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return { error: "You must be signed in to delete a recipe." };
  }

  const { data, error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Recipe could not be deleted." };
  }

  revalidatePath("/");
  redirect("/");
}

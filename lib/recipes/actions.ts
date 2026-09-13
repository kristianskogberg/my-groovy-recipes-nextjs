"use server";

import { getPresetRecipeImages } from "@/lib/recipes/presets";
import { RECIPE_IMAGES_BUCKET } from "@/lib/recipes/storage";
import type { RecipeActionState } from "@/lib/recipes/types";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
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
 * Delete a recipe image from Supabase storage.
 * @param supabase The Supabase client.
 * @param path The path of the image to delete.
 */
async function removeRecipeImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
) {
  // Requires the bucket's SELECT and DELETE policies to be applied.
  // An empty result is allowed so already-missing images don't block retries.
  const { error } = await supabase.storage
    .from(RECIPE_IMAGES_BUCKET)
    .remove([path]);
  if (error) throw error;
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
  locale: string,
  _state: RecipeActionState,
  data: FormData,
): Promise<RecipeActionState> {
  const t = await getTranslations({ locale, namespace: "Errors" });
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return { error: t("signInToSave") };
  }

  const name = String(data.get("name") ?? "").trim();
  const servings = Number(data.get("servings"));
  const timeMinutes = optionalNumber(data.get("time_minutes"));
  const calories = optionalNumber(data.get("calories_per_serving"));

  if (!name || !Number.isFinite(servings) || servings <= 0) {
    return { error: t("invalidRecipe") };
  }

  if (
    (timeMinutes !== null &&
      (!Number.isInteger(timeMinutes) || timeMinutes < 0)) ||
    (calories !== null && (!Number.isInteger(calories) || calories < 0))
  ) {
    return { error: t("invalidNumbers") };
  }

  let previousImageSource: "preset" | "upload" | null = null;
  let previousImageValue: string | null = null;
  if (recipeId) {
    const { data: currentRecipe, error: currentRecipeError } = await supabase
      .from("recipes")
      .select("image_source, image_value")
      .eq("id", recipeId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (currentRecipeError || !currentRecipe) {
      return { error: currentRecipeError?.message ?? t("saveFailed") };
    }

    previousImageSource =
      currentRecipe.image_source === "preset" ||
      currentRecipe.image_source === "upload"
        ? currentRecipe.image_source
        : null;
    previousImageValue = currentRecipe.image_value;
  }

  const presetRecipeImages = await getPresetRecipeImages();
  const selectedSource = String(data.get("image_source") ?? "");
  const selectedImage = String(data.get("image_value") ?? "");
  let imageSource: "preset" | "upload" | null = null;
  let imageValue: string | null = null;
  const imageChanged = data.get("image_changed") === "true";

  if (recipeId && !imageChanged) {
    imageSource = previousImageSource;
    imageValue = previousImageValue;
  } else if (
    selectedSource === "preset" &&
    presetRecipeImages.some((image) => image.value === selectedImage)
  ) {
    imageSource = "preset";
    imageValue = selectedImage;
  } else if (
    selectedSource === "upload" &&
    selectedImage.startsWith(`${auth.user.id}/`) &&
    /^[0-9a-f-]+\.(webp|jpg)$/i.test(selectedImage.slice(auth.user.id.length + 1))
  ) {
    imageSource = "upload";
    imageValue = selectedImage;
  }

  const values = {
    name,
    description: String(data.get("description") ?? "").trim() || null,
    servings,
    time_minutes: timeMinutes,
    calories_per_serving: calories,
    image_source: imageSource,
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
    return { error: error?.message ?? t("saveFailed") };
  }

  if (
    previousImageSource === "upload" &&
    previousImageValue &&
    (imageSource !== "upload" || imageValue !== previousImageValue)
  ) {
    try {
      await removeRecipeImage(supabase, previousImageValue);
    } catch (error) {
      console.error("Could not remove replaced recipe image", error);
    }
  }

  revalidatePath(`/${locale}`);
  if (recipeId) revalidatePath(`/${locale}/recipes/${recipeId}`);
  return { error: null };
}

/**
 * Delete a recipe by its ID.
 * @param id ID of the recipe to delete.
 * @returns A Promise that resolves to the updated RecipeActionState.
 */
export async function deleteRecipe(
  id: string,
  locale: string,
): Promise<RecipeActionState> {
  const t = await getTranslations({ locale, namespace: "Errors" });
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return { error: t("signInToDelete") };
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, image_value")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (recipeError || !recipe) {
    return { error: recipeError?.message ?? t("deleteFailed") };
  }

  const uploadedPath = recipe.image_value?.startsWith(`${auth.user.id}/`)
    ? recipe.image_value
    : null;

  if (uploadedPath) {
    try {
      await removeRecipeImage(supabase, uploadedPath);
    } catch (error) {
      console.error("Could not remove deleted recipe image", error);
      return { error: t("imageDeleteFailed") };
    }
  }

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .single();

  if (error) {
    return { error: error.message ?? t("deleteFailed") };
  }

  revalidatePath(`/${locale}`);
  redirect(`/${locale}`);
}

/** Best-effort cleanup after a failed save, preserving any referenced upload. */
export async function cleanupUnusedRecipeImage(path: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (
    error ||
    !auth.user ||
    !path.startsWith(`${auth.user.id}/`) ||
    !/^[0-9a-f-]+\.(webp|jpg)$/i.test(path.slice(auth.user.id.length + 1))
  )
    return false;
  const { data: recipes, error: queryError } = await supabase
    .from("recipes")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("image_value", path)
    .limit(1);
  if (queryError) return false;
  if (recipes?.length) return true;
  try {
    await removeRecipeImage(supabase, path);
    return true;
  } catch (error) {
    console.error("Could not clean up unused recipe image", error);
    return false;
  }
}

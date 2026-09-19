"use server";

import { getPresetRecipeImages } from "@/lib/recipes/presets";
import { getUploadedRecipeImageUrl, RECIPE_IMAGES_BUCKET } from "@/lib/recipes/storage";
import type { RecipeActionState, SaveRecipeResult } from "@/lib/recipes/types";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

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
 * @returns The saved recipe or a validation/persistence error.
 */
export async function saveRecipe(
  recipeId: string | null,
  locale: string,
  _state: RecipeActionState,
  data: FormData,
): Promise<SaveRecipeResult> {
  const t = await getTranslations({ locale, namespace: "Errors" });
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return { error: t("signInToSave") };
  }

  // A stable client UUID makes retried creates target the same database row.
  const creationId = String(data.get("creation_id") ?? "");
  if (!recipeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creationId)) {
    return { error: t("invalidRecipe") };
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

  let { data: savedRecipe, error } = recipeId
    ? await supabase
        .from("recipes")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", recipeId)
        .eq("user_id", auth.user.id)
        .select("id, name, description, servings, time_minutes, calories_per_serving, image_source, image_value, ingredients, steps, tags")
        .single()
    : await supabase
        .from("recipes")
        .insert({ ...values, id: creationId, user_id: auth.user.id })
        .select("id, name, description, servings, time_minutes, calories_per_serving, image_source, image_value, ingredients, steps, tags")
        .single();

  if (!recipeId && error?.code === "23505") {
    // The original response may have been lost. Return the committed creation;
    // never overwrite a later edit when replaying an old create request.
    const existing = await supabase.from("recipes")
      .select("id, name, description, servings, time_minutes, calories_per_serving, image_source, image_value, ingredients, steps, tags")
      .eq("id", creationId).eq("user_id", auth.user.id).single();
    if (existing.data && !existing.error) {
      const existingRecipe = existing.data;
      const sameDraft = Object.entries(values).every(([key, value]) =>
        key === "servings" ? Number(existingRecipe.servings) === Number(value) :
          JSON.stringify(existingRecipe[key as keyof typeof existingRecipe]) === JSON.stringify(value));
      if (!sameDraft) {
        // Keep revised recovery content instead of treating it as a replay.
        // The next explicit save goes through the normal update path.
        return { error: t("creationConflict"), existingRecipeId: existingRecipe.id };
      }
    }
    savedRecipe = existing.data;
    error = existing.error;
  }

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
  if (recipeId) {
    revalidatePath(`/${locale}/recipes/${recipeId}`);
    revalidatePath(`/${locale}/recipes/${recipeId}/edit`);
  }
  return { error: null, recipe: {
    ...savedRecipe,
    image_url: savedRecipe.image_source === "upload" && savedRecipe.image_value
      ? getUploadedRecipeImageUrl(supabase.storage, savedRecipe.image_value)
      : savedRecipe.image_value,
  } };
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

  if (recipeError) return { error: recipeError.message };
  // A repeated delete after a lost response is already successful.
  if (!recipe) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/recipes/${id}`);
    return { error: null };
  }

  const uploadedPath = recipe.image_value?.startsWith(`${auth.user.id}/`)
    ? recipe.image_value
    : null;

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id");

  if (error) {
    return { error: error.message ?? t("deleteFailed") };
  }

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/recipes/${id}`);
  // Storage cleanup cannot roll back a committed deletion. Retry transient
  // failures without reporting the recipe deletion itself as failed.
  if (uploadedPath) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await removeRecipeImage(supabase, uploadedPath);
        break;
      } catch (error) {
        if (attempt === 2) console.error("Could not remove deleted recipe image after retries", error);
      }
    }
  }
  return { error: null };
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

/** Fresh, authenticated verification after an uncertain delete response. */
export async function confirmRecipeDeleted(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return false;
  const { data, error } = await supabase.from("recipes").select("id")
    .eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  return !error && data === null;
}

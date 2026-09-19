import { cleanupUnusedRecipeImage, saveRecipe } from "@/lib/recipes/actions";
import { RECIPE_IMAGES_BUCKET } from "@/lib/recipes/storage";
import type { SaveRecipeResult } from "@/lib/recipes/types";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";

export const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];
export const maxSourceImageSize = 10 * 1024 * 1024;

/** Runs in the browser, owned by the shared provider rather than the form. */
export async function saveRecipeWithImage(
  recipeId: string | null,
  locale: string,
  data: FormData,
  imageFile: File | null,
  errors: (key: string) => string,
): Promise<SaveRecipeResult> {
  const imageSource = String(data.get("image_source") ?? "");
  const imageValue = String(data.get("image_value") ?? "");
  let uploadedPath: string | null = null;

  if (imageSource === "upload" && imageFile) {
    if (!acceptedImageTypes.includes(imageFile.type)) {
      return { error: errors("invalidImageType") };
    }
    if (imageFile.size > maxSourceImageSize) {
      return { error: errors("imageTooLarge") };
    }

    try {
      let compressed = await imageCompression(imageFile, {
        fileType: "image/webp",
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      // Some browsers can display WebP but cannot encode it with canvas.
      if (compressed.type !== "image/webp") {
        compressed = await imageCompression(imageFile, {
          fileType: "image/jpeg",
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        });
      }
      if (!["image/webp", "image/jpeg"].includes(compressed.type)) {
        return { error: errors("imageCompressionFailed") };
      }
      if (compressed.size === 0 || compressed.size > 2 * 1024 * 1024) {
        return { error: errors("imageCompressionFailed") };
      }
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        return { error: errors("signInToSave") };
      }

      const extension = compressed.type === "image/webp" ? "webp" : "jpg";
      uploadedPath = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(RECIPE_IMAGES_BUCKET)
        .upload(uploadedPath, compressed, {
          cacheControl: "31536000",
          contentType: compressed.type,
          upsert: false,
        });
      if (uploadError) {
        console.error("Recipe image upload failed", {
          message: uploadError.message,
          type: compressed.type,
          size: compressed.size,
        });
        return {
          error: `${errors("imageUploadFailed")} ${uploadError.message}`,
        };
      }

      data.set("image_source", "upload");
      data.set("image_value", uploadedPath);
      data.set("image_changed", "true");
    } catch (error) {
      console.error("Recipe image preparation or upload failed", error);
      return { error: errors("imageCompressionFailed") };
    }
  } else {
    if (imageSource === "upload" && !imageValue) {
      return { error: errors("imageRequired") };
    }
    data.set("image_source", imageSource);
    data.set("image_value", imageSource ? imageValue : "");
  }

  let result;
  try {
    result = await saveRecipe(
      recipeId,
      locale,
      { error: null },
      data,
    );
  } catch {
    // A lost response does not mean the save failed. Leave the image intact
    // because the server may still be attaching it to the recipe.
    return { error: errors("saveFailed") };
  }

  if (uploadedPath && (result.error !== null || result.recipe.image_value !== uploadedPath)) {
    try {
      if (!(await cleanupUnusedRecipeImage(uploadedPath))) {
        console.error("Could not clean up failed recipe upload");
      }
    } catch (error) {
      console.error("Could not clean up failed recipe upload", error);
    }
  }
  return result;
}

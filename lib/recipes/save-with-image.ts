import { cleanupUnusedRecipeImage, saveRecipe } from "@/lib/recipes/actions";
import { RECIPE_IMAGES_BUCKET } from "@/lib/recipes/storage";
import type { SaveRecipeResult } from "@/lib/recipes/types";
import type { RecipeDraft } from "@/lib/recipes/optimistic";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import type messages from "@/messages/en.json";

export const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];
export const maxSourceImageSize = 10 * 1024 * 1024;

/**
 * Compress/upload a selected file, then save a copy of the draft through the server action.
 * isCurrent stops further work after an account change. Lost responses preserve the upload.
 */
export async function saveWithImage(
  draft: RecipeDraft,
  locale: string,
  errors: (key: keyof typeof messages.Errors) => string,
  isCurrent: () => boolean,
): Promise<SaveRecipeResult | { error: string; uncertain: true }> {
  const data = new FormData();
  draft.data.forEach((value, key) => data.append(key, value));
  const recipe = draft.original;
  const imageFile = draft.imageFile;
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

      if (!isCurrent()) return { error: errors("signInToSave") };

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

  if (!isCurrent()) return { error: errors("signInToSave") };

  let result;
  try {
    result = await saveRecipe(
      recipe?.id ?? null,
      locale,
      data,
    );
  } catch {
    // A lost response does not mean the save failed. Leave the image intact
    // because the server may still be attaching it to the recipe.
    return { error: errors("saveUnconfirmed"), uncertain: true };
  }

  if (result?.error && uploadedPath) {
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

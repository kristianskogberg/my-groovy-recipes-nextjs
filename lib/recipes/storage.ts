export const RECIPE_IMAGES_BUCKET = "recipe-images";

/**
 * Get the public URL of an uploaded recipe image.
 * @param storage The Supabase storage client.
 * @param path The path of the image.
 * @returns The public URL of the image.
 */
export function getUploadedRecipeImageUrl(
  storage: {
    from(bucket: string): {
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  },
  path: string,
) {
  return storage.from(RECIPE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

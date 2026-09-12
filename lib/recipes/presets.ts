import "server-only";

import type { PresetRecipeImage } from "@/lib/recipes/types";
import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const imageFilePattern = /^[a-z0-9][a-z0-9_-]*\.(avif|jpe?g|png|webp)$/i;

/**
 * Get a list of all preset recipe images from public/presets directory.
 * Supported extensions are PNG, JPG, JPEG, WebP, and AVIF.
 * @returns A promise that resolves to an array of preset recipe images.
 */
export async function getPresetRecipeImages(): Promise<PresetRecipeImage[]> {
  const files = await readdir(join(process.cwd(), "public", "presets"));

  return files
    .filter((file) => imageFilePattern.test(file))
    .sort()
    .map((file) => ({
      label: basename(file, extname(file))
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      value: `/presets/${file}`,
    }));
}

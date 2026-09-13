"use server";

import { getRecipe } from "@/lib/recipes/queries";

/** Authenticated fallback for a detail page opened without a loaded list. */
export async function loadRecipe(id: string) {
  return getRecipe(id);
}

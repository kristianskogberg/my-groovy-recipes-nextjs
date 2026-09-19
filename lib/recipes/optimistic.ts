import type { Recipe, RecipeCard } from "./types";

export type RecipeSaveOperation = {
  key: string;
  revision: string;
  recipeId: string | null;
  recipe: Recipe;
  data: FormData;
  imageFile: File | null;
  previewUrl: string | null;
  status: "saving" | "saved" | "failed";
  error: string | null;
};

export type RecipeDeleteOperation = {
  recipe: RecipeCard;
  status: "deleting" | "deleted" | "failed";
  error: string | null;
};

export function recipeFormKey(recipeId: string | undefined, draft: RecipeSaveOperation | undefined, version: number) {
  return `${draft ? `recovery:${draft.key}:${draft.revision}` : `recipe:${recipeId ?? "new"}`}:${version}`;
}

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const number = (data: FormData, key: string) => text(data, key) === "" ? null : Number(text(data, key));

export function validateRecipeDraft(data: FormData, file: File | null): string | null {
  const servings = number(data, "servings");
  if (!text(data, "name") || !text(data, "ingredients")) return "invalidRecipe";
  if (servings !== null && (!Number.isFinite(servings) || servings <= 0)) return "invalidServings";
  for (const key of ["time_minutes", "calories_per_serving"]) {
    const value = number(data, key);
    if (value !== null && (!Number.isInteger(value) || value < 0)) return "invalidNumbers";
  }
  if (text(data, "image_source") === "upload") {
    if (!file && !text(data, "image_value")) return "imageRequired";
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "invalidImageType";
    if (file && file.size > 10 * 1024 * 1024) return "imageTooLarge";
  }
  return null;
}

export function recipeFromDraft(data: FormData, id: string, imageUrl: string | null): Recipe {
  const list = (key: string, separator = "\n") => text(data, key).split(separator).map(item => item.trim()).filter(Boolean);
  return {
    id, name: text(data, "name"), description: text(data, "description") || null,
    servings: number(data, "servings"),
    time_minutes: number(data, "time_minutes"), calories_per_serving: number(data, "calories_per_serving"),
    image_source: text(data, "image_source") || null,
    image_value: text(data, "image_value") || null, image_url: imageUrl,
    ingredients: list("ingredients"), steps: list("steps"), tags: list("tags", ","),
  };
}

/** Compare persisted card fields, independent of object key order or numeric serialization. */
export function matchesRecipeCard(a: RecipeCard, b: RecipeCard) {
  return a.id === b.id && a.name === b.name && a.description === b.description &&
    Number(a.servings) === Number(b.servings) && a.time_minutes === b.time_minutes &&
    a.calories_per_serving === b.calories_per_serving && a.image_source === b.image_source &&
    a.image_value === b.image_value && a.image_url === b.image_url &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags);
}

export function mergeRecipeCards(recipes: RecipeCard[], operations: RecipeSaveOperation[], deletions: RecipeDeleteOperation[] = []) {
  const active = operations.filter(operation => operation.status !== "failed");
  const rows = recipes.map(recipe => {
    const operation = active.find(item => item.recipe.id === recipe.id);
    return { recipe: operation?.recipe ?? recipe, pending: operation?.status === "saving" };
  });
  const additions = active.filter(operation => !recipes.some(recipe => recipe.id === operation.recipe.id))
    .map(operation => ({ recipe: operation.recipe, pending: operation.status === "saving" }));
  const merged = [...additions, ...rows];
  for (const deletion of deletions) {
    if (deletion.status === "failed" && !merged.some(row => row.recipe.id === deletion.recipe.id)) {
      merged.push({ recipe: deletion.recipe, pending: false });
    }
  }
  return merged.filter(row => !deletions.some(deletion => deletion.recipe.id === row.recipe.id && deletion.status !== "failed"));
}

import type { Recipe, RecipeCard } from "@/lib/recipes/types";

/** Original form values and file, kept in memory so a failed save can be retried. */
export type RecipeDraft = {
  data: FormData;
  imageFile: File | null;
  original?: Recipe;
};

/** One local change: pending request, saved result awaiting refresh, or failed draft. */
export type RecipeMutation = {
  key: string;
  recipeId: string | null;
  kind: "save" | "delete";
  status: "pending" | "saved" | "failed";
  recipe?: Recipe;
  draft?: RecipeDraft;
  previewUrl?: string;
  error?: string;
};

/** Build the immediate preview without changing the original form values. */
export function recipeFromDraft(draft: RecipeDraft, id: string, imageUrl: string | null): Recipe {
  const value = (name: string) => String(draft.data.get(name) ?? "");
  const list = (name: string, separator = "\n") => value(name).split(separator).map(item => item.trim()).filter(Boolean);
  return {
    id,
    name: value("name").trim(),
    description: value("description").trim() || null,
    servings: Number(value("servings")),
    time_minutes: value("time_minutes") === "" ? null : Number(value("time_minutes")),
    calories_per_serving: value("calories_per_serving") === "" ? null : Number(value("calories_per_serving")),
    image_source: value("image_source") || null,
    image_value: value("image_value") || null,
    image_url: imageUrl,
    ingredients: list("ingredients"),
    steps: list("steps"),
    tags: list("tags", ","),
  };
}

/** Apply local saves/deletes over server cards; ignoring failures restores server data. */
export function overlayRecipes(recipes: RecipeCard[], mutations: RecipeMutation[]) {
  let result = recipes;
  for (const mutation of mutations) {
    if (mutation.status === "failed") continue;
    if (mutation.kind === "delete") {
      result = result.filter(recipe => recipe.id !== mutation.recipeId);
    } else if (mutation.recipe) {
      const replacement = mutation.recipe;
      const exists = result.some(recipe => recipe.id === replacement.id);
      result = exists
        ? result.map(recipe => recipe.id === replacement.id ? replacement : recipe)
        : [replacement, ...result];
    }
  }
  return result;
}

/** True when server cards contain the saved result and its local overlay can be removed. */
// Database numeric columns may arrive as strings.
export function mutationIsReflected(mutation: RecipeMutation, recipes: Recipe[]) {
  if (mutation.status !== "saved") return false;
  if (mutation.kind === "delete") return !recipes.some(recipe => recipe.id === mutation.recipeId);
  const expected = mutation.recipe;
  const actual = recipes.find(recipe => recipe.id === expected?.id);
  if (!actual || !expected) return false;
  return actual.name === expected.name && actual.description === expected.description &&
    Number(actual.servings) === Number(expected.servings) &&
    actual.time_minutes === expected.time_minutes &&
    actual.calories_per_serving === expected.calories_per_serving &&
    actual.image_source === expected.image_source && actual.image_value === expected.image_value &&
    JSON.stringify(actual.tags) === JSON.stringify(expected.tags) &&
    JSON.stringify(actual.ingredients) === JSON.stringify(expected.ingredients) &&
    JSON.stringify(actual.steps) === JSON.stringify(expected.steps);
}

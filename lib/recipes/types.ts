/**
 * Recipe schema (Supabase table definition).
 * @typedef {Object} Recipe
 * @property {string} id - The unique identifier for the recipe.
 * @property {string} name - The name of the recipe.
 * @property {string | null} description - A description of the recipe.
 * @property {number | string} servings - The number of servings the recipe makes.
 * @property {number | null} time_minutes - The time in minutes it takes to prepare the recipe.
 * @property {number | null} calories_per_serving - The number of calories per serving.
 * @property {string | null} image_source - The source of the image (e.g., "preset" or null).
 * @property {string | null} image_value - The value of the image (e.g., a URL or preset value).
 * @property {string[]} ingredients - An array of ingredients for the recipe.
 * @property {string[]} steps - An array of steps to prepare the recipe.
 * @property {string[]} tags - An array of tags for the recipe.
 */
export type Recipe = {
  id: string;
  name: string;
  description: string | null;
  servings: number | string;
  time_minutes: number | null;
  calories_per_serving: number | null;
  image_source: string | null;
  image_value: string | null;
  image_url: string | null;
  ingredients: string[];
  steps: string[];
  tags: string[];
};

/**
 * A simplified version of the Recipe type (used for displaying recipe cards).
 */
export type RecipeCard = Omit<Recipe, "ingredients" | "steps">;

export type PresetRecipeImage = { label: string; value: string };

/**
 * The state of a recipe action (e.g., saving or deleting a recipe).
 */
export type RecipeActionState = { error: string | null };

export type SaveRecipeResult =
  | { error: string; recipe?: never; existingRecipeId?: string }
  | { error: null; recipe: Recipe };

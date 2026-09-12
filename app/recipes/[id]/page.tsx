import { CreateRecipeForm } from "@/components/create-recipe-form";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { Button } from "@/components/ui/button";
import { getPresetRecipeImages } from "@/lib/recipes/presets";
import { getRecipe } from "@/lib/recipes/queries";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function RecipeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "new") {
    const presetImages = await getPresetRecipeImages();

    return (
      <section>
        <h1 className="text-2xl font-bold">Create a recipe</h1>
        <CreateRecipeForm presetImages={presetImages} />
      </section>
    );
  }

  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  return (
    <article className="grid max-w-2xl gap-6">
      {recipe.image_source === "preset" && recipe.image_value && (
        <Image
          alt={recipe.name}
          className="aspect-video w-full rounded-lg object-cover"
          height={400}
          priority
          src={recipe.image_value}
          width={700}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">{recipe.name}</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/recipes/${recipe.id}/edit`}>Edit</Link>
          </Button>
          <DeleteRecipeButton id={recipe.id} />
        </div>
      </div>

      {recipe.description && <p>{recipe.description}</p>}

      <p>
        {recipe.servings} servings
        {recipe.time_minutes !== null && ` / ${recipe.time_minutes} min`}
        {recipe.calories_per_serving !== null &&
          ` / ${recipe.calories_per_serving} kcal`}
      </p>

      {recipe.ingredients.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Ingredients</h2>
          <ul className="mt-2 list-disc pl-5">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={`${ingredient}-${index}`}>{ingredient}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Steps</h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {recipe.steps.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      {recipe.tags.length > 0 && <p>{recipe.tags.join(" / ")}</p>}
    </article>
  );
}

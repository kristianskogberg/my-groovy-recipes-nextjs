import { CreateRecipeForm } from "@/components/create-recipe-form";
import { getPresetRecipeImages } from "@/lib/recipes/presets";
import { getRecipe } from "@/lib/recipes/queries";
import { notFound } from "next/navigation";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [recipe, presetImages] = await Promise.all([
    getRecipe(id),
    getPresetRecipeImages(),
  ]);

  if (!recipe) notFound();

  return (
    <section>
      <h1 className="text-2xl font-bold">Edit recipe</h1>
      <CreateRecipeForm presetImages={presetImages} recipe={recipe} />
    </section>
  );
}

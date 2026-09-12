"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveRecipe } from "@/lib/recipes/actions";
import type { PresetRecipeImage, Recipe } from "@/lib/recipes/types";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

/**
 * A form for creating or editing a recipe.
 * @param recipe - The recipe to edit, if it exists.
 * @returns A React component.
 */
export function CreateRecipeForm({
  presetImages,
  recipe,
}: {
  presetImages: PresetRecipeImage[];
  recipe?: Recipe;
}) {
  const t = useTranslations("Recipe");
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState(
    saveRecipe.bind(null, recipe?.id ?? null, locale),
    { error: null },
  );

  return (
    <form action={formAction} className="mt-6 grid max-w-xl gap-4">
      <Field defaultValue={recipe?.name} label={t("name")} name="name" required />

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{t("image")}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="cursor-pointer">
            <input
              className="peer sr-only"
              defaultChecked={!recipe?.image_value}
              name="image_value"
              type="radio"
              value=""
            />
            <span className="flex aspect-square items-center justify-center rounded-md border text-sm ring-2 ring-transparent peer-checked:ring-primary">
              {t("noImage")}
            </span>
          </label>
          {presetImages.map((image) => (
            <label className="cursor-pointer" key={image.value}>
              <input
                className="peer sr-only"
                defaultChecked={recipe?.image_value === image.value}
                name="image_value"
                type="radio"
                value={image.value}
              />
              <Image
                alt={image.label}
                className="aspect-square w-full rounded-md object-cover ring-2 ring-transparent peer-checked:ring-primary"
                height={140}
                src={image.value}
                width={140}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2">
        <span className="text-sm font-medium">{t("description")}</span>
        <Textarea
          defaultValue={recipe?.description ?? ""}
          name="description"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          defaultValue={recipe?.servings}
          label={t("servings")}
          min="0.01"
          name="servings"
          required
          step="any"
          type="number"
        />
        <Field
          defaultValue={recipe?.time_minutes ?? ""}
          label={t("time")}
          min="0"
          name="time_minutes"
          type="number"
        />
        <Field
          defaultValue={recipe?.calories_per_serving ?? ""}
          label={t("calories")}
          min="0"
          name="calories_per_serving"
          type="number"
        />
      </div>

      <TextList
        defaultValue={recipe?.ingredients.join("\n")}
        label={t("ingredients")}
        name="ingredients"
        placeholder={t("ingredientsPlaceholder")}
      />
      <TextList
        defaultValue={recipe?.steps.join("\n")}
        label={t("steps")}
        name="steps"
        placeholder={t("stepsPlaceholder")}
      />
      <Field
        defaultValue={recipe?.tags.join(", ")}
        label={t("tags")}
        name="tags"
        placeholder={t("tagsPlaceholder")}
      />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button className="w-fit" disabled={isPending} type="submit">
        {isPending ? t("saving") : recipe ? t("save") : t("create")}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function TextList({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Textarea
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

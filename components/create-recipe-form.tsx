"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { cleanupUnusedRecipeImage, saveRecipe } from "@/lib/recipes/actions";
import { RECIPE_IMAGES_BUCKET } from "@/lib/recipes/storage";
import type { PresetRecipeImage, Recipe } from "@/lib/recipes/types";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageUp, Plus, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";

type ImageSource = "" | "preset" | "upload";
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxSourceImageSize = 10 * 1024 * 1024;

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
  const errors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [imageSource, setImageSource] = useState<ImageSource>(
    recipe?.image_source === "preset" || recipe?.image_source === "upload"
      ? recipe.image_source
      : "",
  );
  const [imageValue, setImageValue] = useState(recipe?.image_value ?? "");
  const [imageChanged, setImageChanged] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  async function saveWithImage(
    previousState: { error: string | null },
    data: FormData,
  ) {
    let uploadedPath: string | null = null;

    if (imageSource === "upload" && imageFile) {
      if (!acceptedImageTypes.includes(imageFile.type)) {
        return { error: errors("invalidImageType") };
      }
      if (imageFile.size > maxSourceImageSize) {
        return { error: errors("imageTooLarge") };
      }

      try {
        const compressed = await imageCompression(imageFile, {
          fileType: "image/webp",
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        });
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) {
          return { error: errors("signInToSave") };
        }

        uploadedPath = `${auth.user.id}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from(RECIPE_IMAGES_BUCKET)
          .upload(uploadedPath, compressed, {
            cacheControl: "31536000",
            contentType: "image/webp",
            upsert: false,
          });
        if (uploadError) return { error: errors("imageUploadFailed") };

        data.set("image_source", "upload");
        data.set("image_value", uploadedPath);
        data.set("image_changed", "true");
      } catch {
        return { error: errors("imageCompressionFailed") };
      }
    } else {
      if (imageSource === "upload" && !imageValue) {
        return { error: errors("imageRequired") };
      }
      data.set("image_source", imageSource);
      data.set("image_value", imageSource ? imageValue : "");
    }

    let result;
    try {
      result = await saveRecipe(
        recipe?.id ?? null,
        locale,
        previousState,
        data,
      );
    } catch {
      // A lost response does not mean the save failed. Leave the image intact
      // because the server may still be attaching it to the recipe.
      return { error: errors("saveFailed") };
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
    if (!result.error) {
      if (!recipe) {
        // Clear React state too, so a reused new-recipe form starts empty.
        setImageSource("");
        setImageValue("");
        setImageFile(null);
        setImageChanged(false);
        setImageError(null);
        setPreviewUrl(null);
      }
      router.push(recipe ? `/${locale}/recipes/${recipe.id}` : `/${locale}`);
      router.refresh();
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(saveWithImage, {
    error: null,
  });

  return (
    <form action={formAction} className="mt-6 grid max-w-xl gap-4">
      <Field
        defaultValue={recipe?.name}
        label={t("name")}
        name="name"
        required
      />

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">{t("image")}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="cursor-pointer">
            <input
              className="peer sr-only"
              checked={imageSource === ""}
              name="image_choice"
              onChange={() => {
                setImageSource("");
                setImageValue("");
                setImageFile(null);
                setImageChanged(true);
                setImageError(null);
              }}
              type="radio"
              value="none"
            />
            <span className="flex aspect-square items-center justify-center rounded-md border text-sm ring-2 ring-transparent peer-checked:ring-primary">
              {t("noImage")}
            </span>
          </label>
          <label className="cursor-pointer">
            <input
              className="peer sr-only"
              checked={imageSource === "upload"}
              name="image_choice"
              onChange={() => {
                setImageSource("upload");
                setImageValue(
                  recipe?.image_source === "upload"
                    ? (recipe.image_value ?? "")
                    : "",
                );
                setImageChanged(true);
                setImageError(null);
              }}
              type="radio"
              value="upload"
            />
            <span className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border text-sm ring-2 ring-transparent peer-checked:ring-primary">
              <ImageUp className="size-5" />
              {t("uploadImage")}
            </span>
          </label>
          {presetImages.map((image) => (
            <label className="cursor-pointer" key={image.value}>
              <input
                className="peer sr-only"
                checked={imageSource === "preset" && imageValue === image.value}
                name="image_choice"
                onChange={() => {
                  setImageSource("preset");
                  setImageValue(image.value);
                  setImageFile(null);
                  setImageChanged(true);
                  setImageError(null);
                }}
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
        {imageSource === "upload" && (
          <div className="grid gap-3 rounded-md border border-input p-3">
            {(previewUrl ||
              (recipe?.image_source === "upload" && recipe.image_url)) && (
              <Image
                alt={t("uploadPreview")}
                className="aspect-video w-full max-w-sm rounded-md object-cover"
                height={240}
                src={previewUrl ?? recipe!.image_url!}
                unoptimized={Boolean(previewUrl)}
                width={400}
              />
            )}
            <Input
              accept={acceptedImageTypes.join(",")}
              aria-describedby="image-upload-help"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setImageError(null);
                if (file && !acceptedImageTypes.includes(file.type)) {
                  setImageError(errors("invalidImageType"));
                  setImageFile(null);
                  return;
                }
                if (file && file.size > maxSourceImageSize) {
                  setImageError(errors("imageTooLarge"));
                  setImageFile(null);
                  return;
                }
                setImageFile(file);
                if (file) {
                  setImageValue("");
                  setImageChanged(true);
                }
              }}
              type="file"
            />
            <p className="text-xs text-muted-foreground" id="image-upload-help">
              {t("uploadHelp")}
            </p>
            {imageError && (
              <p className="text-sm text-destructive">{imageError}</p>
            )}
          </div>
        )}
        <input name="image_source" type="hidden" value={imageSource} />
        <input name="image_value" type="hidden" value={imageValue} />
        <input
          name="image_changed"
          type="hidden"
          value={String(imageChanged)}
        />
      </fieldset>

      <label className="grid gap-2">
        <span className="text-sm font-medium">{t("description")}</span>
        <Textarea defaultValue={recipe?.description ?? ""} name="description" />
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
      <TagInput
        defaultValue={recipe?.tags}
        label={t("tags")}
        name="tags"
        placeholder={t("tagsPlaceholder")}
        removeLabel={(tag) => t("removeTag", { tag })}
      />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button
        className="w-fit"
        disabled={isPending}
        icon={recipe ? <Save /> : <Plus />}
        type="submit"
      >
        {isPending ? t("saving") : recipe ? t("save") : t("create")}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>
        {label}
        {required && (
          <span className="text-accent" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </Label>
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

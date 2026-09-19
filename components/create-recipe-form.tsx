"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { useRecipeSaves } from "@/components/recipe-save-provider";
import { recipeFormKey, validateRecipeDraft, type RecipeSaveOperation } from "@/lib/recipes/optimistic";
import { acceptedImageTypes, maxSourceImageSize } from "@/lib/recipes/save-with-image";
import type { PresetRecipeImage, Recipe } from "@/lib/recipes/types";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Clock,
  Flame,
  Images,
  ImageUp,
  UserRound,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type ImageSource = "" | "preset" | "upload";

/**
 * A form for creating or editing a recipe.
 * @param recipe - The recipe to edit, if it exists.
 * @returns A React component.
 */
export function CreateRecipeForm(props: { presetImages: PresetRecipeImage[]; recipe?: Recipe }) {
  const { operations } = useRecipeSaves();
  const recoveryKey = useSearchParams().get("draft");
  const [formVersion, setFormVersion] = useState(0);
  const submitted = useRef(false);
  const [submittedForm, setSubmittedForm] = useState<{
    key: string;
    recipe?: Recipe;
    draft?: RecipeSaveOperation;
  } | null>(null);
  const draft = operations.find((operation) => operation.key === recoveryKey &&
    operation.status === "failed" &&
    operation.recipeId === (props.recipe?.id ?? null));
  const initialForm = submittedForm ?? {
    key: `${recipeFormKey(props.recipe?.id, draft, formVersion)}:${JSON.stringify(props.recipe)}`,
    recipe: props.recipe,
    draft,
  };

  // Activity runs layout-effect cleanup when navigation hides this page.
  // Reset a submitted form only then, never while the user can still see it.
  useLayoutEffect(() => () => {
    if (!submitted.current) return;
    submitted.current = false;
    setSubmittedForm(null);
    setFormVersion(version => version + 1);
  }, []);

  return <RecipeForm
    key={initialForm.key}
    {...props}
    recipe={initialForm.recipe}
    draft={initialForm.draft}
    onSubmitted={() => {
      submitted.current = true;
      setSubmittedForm(initialForm);
    }}
  />;
}

function RecipeForm({
  presetImages,
  recipe: originalRecipe,
  draft,
  onSubmitted,
}: {
  presetImages: PresetRecipeImage[];
  recipe?: Recipe;
  draft?: RecipeSaveOperation;
  onSubmitted: () => void;
}) {
  const recipe = draft?.recipe ?? originalRecipe;
  const { enqueue, operations } = useRecipeSaves();
  const t = useTranslations("Recipe");
  const errors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const presetButtonRef = useRef<HTMLButtonElement>(null);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageId = useId();
  const [imageSource, setImageSource] = useState<ImageSource>(
    recipe?.image_source === "preset" || recipe?.image_source === "upload"
      ? recipe.image_source
      : "",
  );
  const [imageValue, setImageValue] = useState(recipe?.image_value ?? "");
  const [imageChanged, setImageChanged] = useState(draft?.data.get("image_changed") === "true");
  const [imageFile, setImageFile] = useState<File | null>(draft?.imageFile ?? null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const displayedImage =
    imageSource === "preset"
      ? imageValue
      : imageSource === "upload"
        ? imageFile
          ? previewUrl
          : recipe?.image_url
        : null;

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const isPending = isSubmitted || operations.some((operation) =>
    operation.status === "saving" && operation.key === (originalRecipe?.id ?? draft?.key),
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current || isPending) return;
    const data = new FormData(event.currentTarget);
    const validationError = validateRecipeDraft(data, imageFile);
    if (validationError) {
      setError(errors(validationError));
      return;
    }
    const result = enqueue({ data, imageFile, recipeId: originalRecipe?.id ?? null, draftKey: draft?.key,
      existingImageUrl: recipe?.image_url ?? null });
    if (result.error) {
      setError(result.error);
      return;
    }
    submitted.current = true;
    setIsSubmitted(true);
    onSubmitted();
    router.push(`/${locale}`);
  }

  return (
    <form onSubmit={submit} className="mt-6 grid max-w-xl gap-4" aria-busy={isPending}>
      <fieldset className="grid min-w-0 gap-2" disabled={isPending}>
        <legend className="sr-only">{t("image")}</legend>
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          {displayedImage ? (
            <Image
              alt={t("uploadPreview")}
              className="object-cover"
              fill
              sizes="(max-width: 640px) 100vw, 576px"
              src={displayedImage}
              unoptimized={imageSource === "upload" && Boolean(imageFile)}
            />
          ) : (
            <span className="sr-only">{t("noImage")}</span>
          )}
          {imageSource && (
            <Button
              aria-label={t("removeImage")}
              ref={removeButtonRef}
              className="absolute right-3 top-3"
              icon={<X />}
              onClick={() => {
                setImageSource("");
                setImageValue("");
                setImageFile(null);
                setPreviewUrl(null);
                setImageChanged(true);
                setImageError(null);
              }}
              size="icon"
              type="button"
              variant="outline"
            />
          )}
          {!imageSource && (
            <div className="absolute inset-0 flex flex-col flex-wrap items-center justify-center gap-3 p-3">
              <Button
                aria-describedby={imageId + "-help"}
                icon={<ImageUp />}
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("uploadImage")}
              </Button>
              <span className="text-sm text-muted-foreground">{t("or")}</span>
              <Button
                aria-haspopup="dialog"
                aria-controls={imageId + "-dialog"}
                icon={<Images />}
                onClick={() => dialogRef.current?.showModal()}
                ref={presetButtonRef}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("choosePreset")}
              </Button>
            </div>
          )}
        </div>
        <input
          accept={acceptedImageTypes.join(",")}
          aria-label={t("uploadImage")}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (!acceptedImageTypes.includes(file.type)) {
              setImageError(errors("invalidImageType"));
              return;
            }
            if (file.size > maxSourceImageSize) {
              setImageError(errors("imageTooLarge"));
              return;
            }
            setImageSource("upload");
            setImageValue("");
            setImageFile(file);
            setPreviewUrl(null);
            setImageChanged(true);
            setImageError(null);
          }}
          ref={fileInputRef}
          type="file"
        />

        {imageError && (
          <p className="text-sm text-destructive" role="alert">
            {imageError}
          </p>
        )}

        <dialog
          aria-labelledby={imageId + "-title"}
          className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-lg border border-border bg-background p-4 text-foreground shadow-xl backdrop:bg-black/50 sm:p-6"
          id={imageId + "-dialog"}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            ) {
              event.currentTarget.close();
            }
          }}
          onClose={() =>
            (presetButtonRef.current ?? removeButtonRef.current)?.focus()
          }
          ref={dialogRef}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold" id={imageId + "-title"}>
              {t("choosePreset")}
            </h2>
            <Button
              aria-label={t("closeImagePicker")}
              autoFocus
              icon={<X />}
              onClick={() => dialogRef.current?.close()}
              size="icon"
              type="button"
              variant="ghost"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {presetImages.map((image) => (
              <button
                aria-label={image.label}
                aria-pressed={
                  imageSource === "preset" && imageValue === image.value
                }
                className="relative rounded-md ring-2 ring-transparent ring-offset-2 ring-offset-background transition-shadow hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-ring aria-pressed:ring-primary disabled:opacity-50"
                key={image.value}
                onClick={() => {
                  setImageSource("preset");
                  setImageValue(image.value);
                  setImageFile(null);
                  setPreviewUrl(null);
                  setImageChanged(true);
                  setImageError(null);
                  dialogRef.current?.close();
                }}
                type="button"
              >
                <Image
                  alt=""
                  className="aspect-square w-full rounded-md object-cover"
                  height={140}
                  src={image.value}
                  width={140}
                />
              </button>
            ))}
          </div>
        </dialog>
      </fieldset>
      <input name="image_source" type="hidden" value={imageSource} />
      <input name="image_value" type="hidden" value={imageValue} />
      <input name="image_changed" type="hidden" value={String(imageChanged)} />

      <Field
        defaultValue={recipe?.name}
        label={t("name")}
        name="name"
        required
      />
      <label className="grid gap-2">
        <span className="text-sm font-medium">{t("description")}</span>
        <Textarea defaultValue={recipe?.description ?? ""} name="description" />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          defaultValue={recipe?.servings ?? ""}
          icon={<UserRound />}
          label={t("servings")}
          min="0.01"
          name="servings"
          step="any"
          type="number"
        />
        <Field
          defaultValue={recipe?.calories_per_serving ?? ""}
          icon={<Flame />}
          label={t("calories")}
          min="0"
          name="calories_per_serving"
          type="number"
        />
        <Field
          defaultValue={recipe?.time_minutes ?? ""}
          icon={<Clock />}
          label={t("time")}
          min="0"
          name="time_minutes"
          type="number"
        />
      </div>

      <TextList
        defaultValue={recipe?.ingredients.join("\n")}
        label={t("ingredients")}
        name="ingredients"
        placeholder={t("ingredientsPlaceholder")}
        required
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

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex w-full justify-end">
        <Button
          className="h-11 w-fit"
          disabled={isPending}
          icon={<Bookmark />}
          type="submit"
        >
          {isPending ? t("saving") : originalRecipe ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  icon,
  label,
  name,
  required,
  ...props
}: React.ComponentProps<typeof Input> & {
  icon?: React.ReactNode;
  label: string;
  name: string;
}) {
  return (
    <div className="grid gap-2">
      <Label className="inline-flex items-center gap-1.5" htmlFor={name}>
        {icon && (
          <span aria-hidden="true" className="[&_svg]:size-4">
            {icon}
          </span>
        )}
        <span>
          {label}
          {required && (
            <span className="text-accent" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </span>
      </Label>
      <Input id={name} name={name} required={required} {...props} />
    </div>
  );
}

function TextList({
  defaultValue,
  label,
  name,
  placeholder,
  required,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-accent" aria-hidden="true"> *</span>}
      </span>
      <Textarea
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

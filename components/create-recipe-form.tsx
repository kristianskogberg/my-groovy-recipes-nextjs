"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { useRecipeMutations } from "@/components/recipe-mutation-provider";
import type { RecipeDraft } from "@/lib/recipes/optimistic";
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
import { useEffect, useId, useRef, useState } from "react";

type ImageSource = "" | "preset" | "upload";

type FormProps = { presetImages: PresetRecipeImage[]; recipe?: Recipe };

/** Restore a requested failed draft, or reset the new form after a successful create. */
export function CreateRecipeForm(props: FormProps) {
  const search = useSearchParams();
  const { mutations, newRecipeFormVersion } = useRecipeMutations();
  const recovered = mutations.find(item => item.key === search.get("draft") &&
    item.status === "failed" && item.recipeId === (props.recipe?.id ?? null));
  const formKey = props.recipe
    ? search.get("draft") ?? props.recipe.id
    : `${search.get("draft") ?? "new"}:${newRecipeFormVersion}`;
  return <RecipeForm key={formKey} {...props}
    recoveredKey={recovered?.key} draft={recovered?.draft} />;
}

/** Hold editable fields and image choices; the provider owns the submitted snapshot. */
function RecipeForm({ presetImages, recipe, draft: initialDraft, recoveredKey }: FormProps & {
  draft?: RecipeDraft;
  recoveredKey?: string;
}) {
  // Dismissing the recovery notice must not reset a form already being edited.
  const [draft] = useState(initialDraft);
  const { save, isPending: recipeIsPending } = useRecipeMutations();
  const isPending = recipeIsPending(recipe?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  /** Use the raw failed value when present; otherwise let the field use its recipe default. */
  const restored = (name: string) => draft ? String(draft.data.get(name) ?? "") : undefined;
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
    (restored("image_source") ?? recipe?.image_source ?? "") as ImageSource,
  );
  const [imageValue, setImageValue] = useState(restored("image_value") ?? recipe?.image_value ?? "");
  const [imageChanged, setImageChanged] = useState(restored("image_changed") === "true");
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
    let cancelled = false;
    // Decode large device photos before painting them so the form stays responsive.
    const preview = new window.Image();
    preview.decoding = "async";
    preview.src = url;
    void preview.decode().then(() => {
      if (!cancelled) setPreviewUrl(url);
    }).catch(() => {
      // Let the image element handle formats that cannot be predecoded.
      if (!cancelled) setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  useEffect(() => {
    router.prefetch(`/${locale}`);
  }, [router, locale]);

  /** Snapshot the valid form and hand it to the provider before this page is left. */
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const data = new FormData(event.currentTarget);
    if (!String(data.get("name") ?? "").trim()) {
      setError(errors("invalidRecipe"));
      return;
    }
    save({ data, imageFile, original: recipe }, recoveredKey);
  }

  return (
    <form onSubmit={submit} className="mt-6 grid max-w-xl gap-4">
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
              decoding="async"
              loading="eager"
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
        defaultValue={restored("name") ?? recipe?.name}
        label={t("name")}
        name="name"
        required
      />
      <label className="grid gap-2">
        <span className="text-sm font-medium">{t("description")}</span>
        <Textarea defaultValue={restored("description") ?? recipe?.description ?? ""} name="description" />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          defaultValue={restored("servings") ?? recipe?.servings}
          icon={<UserRound />}
          label={t("servings")}
          min="0.01"
          name="servings"
          required
          step="any"
          type="number"
        />
        <Field
          defaultValue={restored("calories_per_serving") ?? recipe?.calories_per_serving ?? ""}
          icon={<Flame />}
          label={t("calories")}
          min="0"
          name="calories_per_serving"
          type="number"
        />
        <Field
          defaultValue={restored("time_minutes") ?? recipe?.time_minutes ?? ""}
          icon={<Clock />}
          label={t("time")}
          min="0"
          name="time_minutes"
          type="number"
        />
      </div>

      <TextList
        defaultValue={restored("ingredients") ?? recipe?.ingredients.join("\n")}
        label={t("ingredients")}
        name="ingredients"
        placeholder={t("ingredientsPlaceholder")}
      />
      <TextList
        defaultValue={restored("steps") ?? recipe?.steps.join("\n")}
        label={t("steps")}
        name="steps"
        placeholder={t("stepsPlaceholder")}
      />
      <TagInput
        defaultValue={draft ? restored("tags")?.split(",").filter(Boolean) : recipe?.tags}
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
          {isPending ? t("saving") : recipe ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}

/** Render a labeled input, including native browser validation such as required. */
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

/** Edit an ingredient or step list as one item per line. */
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

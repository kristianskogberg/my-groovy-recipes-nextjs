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
import { useActionState, useEffect, useId, useRef, useState } from "react";

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
  const [imageChanged, setImageChanged] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
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
        let compressed = await imageCompression(imageFile, {
          fileType: "image/webp",
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        });
        // Some browsers can display WebP but cannot encode it with canvas.
        if (compressed.type !== "image/webp") {
          compressed = await imageCompression(imageFile, {
            fileType: "image/jpeg",
            maxSizeMB: 1,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
          });
        }
        if (!["image/webp", "image/jpeg"].includes(compressed.type)) {
          return { error: errors("imageCompressionFailed") };
        }
        if (compressed.size === 0 || compressed.size > 2 * 1024 * 1024) {
          return { error: errors("imageCompressionFailed") };
        }
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) {
          return { error: errors("signInToSave") };
        }

        const extension = compressed.type === "image/webp" ? "webp" : "jpg";
        uploadedPath = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(RECIPE_IMAGES_BUCKET)
          .upload(uploadedPath, compressed, {
            cacheControl: "31536000",
            contentType: compressed.type,
            upsert: false,
          });
        if (uploadError) {
          console.error("Recipe image upload failed", {
            message: uploadError.message,
            type: compressed.type,
            size: compressed.size,
          });
          return {
            error: `${errors("imageUploadFailed")} ${uploadError.message}`,
          };
        }

        data.set("image_source", "upload");
        data.set("image_value", uploadedPath);
        data.set("image_changed", "true");
      } catch (error) {
        console.error("Recipe image preparation or upload failed", error);
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
          defaultValue={recipe?.servings}
          icon={<UserRound />}
          label={t("servings")}
          min="0.01"
          name="servings"
          required
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

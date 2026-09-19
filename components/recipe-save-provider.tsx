"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmRecipeDeleted, deleteRecipe } from "@/lib/recipes/actions";
import { saveRecipeWithImage } from "@/lib/recipes/save-with-image";
import { createClient } from "@/lib/supabase/client";
import { matchesRecipeCard, recipeFromDraft, type RecipeSaveOperation, type RecipeDeleteOperation } from "@/lib/recipes/optimistic";
import type { RecipeCard } from "@/lib/recipes/types";

type Submission = {
  data: FormData;
  imageFile: File | null;
  recipeId: string | null;
  draftKey?: string;
  existingImageUrl: string | null;
};
type SaveContext = {
  operations: RecipeSaveOperation[];
  deletions: RecipeDeleteOperation[];
  enqueueDelete: (recipe: RecipeCard) => boolean;
  enqueue: (submission: Submission) => { error: string | null };
  reconcile: (recipes: RecipeCard[]) => void;
};
const Context = createContext<SaveContext | null>(null);

export function useRecipeSaves() {
  const context = useContext(Context);
  if (!context) throw new Error("RecipeSaveProvider is required");
  return context;
}

export function RecipeSaveProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = useState<RecipeSaveOperation[]>([]);
  const current = useRef<RecipeSaveOperation[]>([]);
  const [deletions, setDeletions] = useState<RecipeDeleteOperation[]>([]);
  const currentDeletes = useRef<RecipeDeleteOperation[]>([]);
  const updateDeletes = useCallback((next: RecipeDeleteOperation[]) => {
    currentDeletes.current = next;
    if (mounted.current) setDeletions(next);
  }, []);
  const deletionChecks = useRef(new WeakMap<RecipeDeleteOperation, RecipeCard[]>());
  const previews = useRef(new Set<string>());
  const mounted = useRef(true);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Recipe");
  const errors = useTranslations("Errors");

  const update = useCallback((next: RecipeSaveOperation[]) => {
    current.current = next;
    if (mounted.current) setOperations(next);
  }, []);

  // Revoke only after React has committed replacement images.
  useEffect(() => {
    const retained = new Set(operations.map(operation => operation.previewUrl));
    for (const url of previews.current) {
      if (!retained.has(url)) {
        URL.revokeObjectURL(url);
        previews.current.delete(url);
      }
    }
  }, [operations]);

  useEffect(() => {
    mounted.current = true;
    const urls = previews.current;
    return () => {
      mounted.current = false;
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        update([]);
        updateDeletes([]);
      }
    });
    return () => subscription.unsubscribe();
  }, [update, updateDeletes]);

  const verifyDeletion = useCallback(async (operation: RecipeDeleteOperation) => {
    try {
      if (!(await confirmRecipeDeleted(operation.recipe.id))) return;
      if (!mounted.current || !currentDeletes.current.includes(operation)) return;
      update(current.current.filter(item => item.recipe.id !== operation.recipe.id));
      updateDeletes(currentDeletes.current.map(item => item === operation
        ? { ...item, status: "deleted", error: null } : item));
    } catch {
      // Keep the recoverable error if verification is also offline.
    }
  }, [update, updateDeletes]);

  const reconcile = useCallback((recipes: RecipeCard[]) => {
    const next = current.current.filter(operation => operation.status !== "saved" ||
      !recipes.some(recipe => matchesRecipeCard(recipe, operation.recipe)));
    if (next.length !== current.current.length) update(next);
    const remaining = currentDeletes.current.filter(operation => operation.status !== "deleted" ||
      recipes.some(recipe => recipe.id === operation.recipe.id));
    if (remaining.length !== currentDeletes.current.length) updateDeletes(remaining);
    for (const operation of remaining) {
      if (operation.status === "failed" && !recipes.some(recipe => recipe.id === operation.recipe.id) &&
        deletionChecks.current.get(operation) !== recipes) {
        deletionChecks.current.set(operation, recipes);
        void verifyDeletion(operation);
      }
    }
  }, [update, updateDeletes, verifyDeletion]);

  function enqueue(submission: Submission) {
    const key = submission.recipeId ?? submission.draftKey ?? crypto.randomUUID();
    if (current.current.some(operation => operation.key === key && operation.status === "saving")) return { error: errors("saveInProgress") };
    if (currentDeletes.current.some(operation => operation.recipe.id === key && operation.status !== "failed")) return { error: errors("saveDuringDelete") };
    const data = new FormData();
    submission.data.forEach((value, name) => data.append(name, value));
    if (!submission.recipeId) data.set("creation_id", key);
    const previewUrl = submission.imageFile ? URL.createObjectURL(submission.imageFile) : null;
    if (previewUrl) previews.current.add(previewUrl);
    const source = data.get("image_source");
    const imageUrl = source === "preset" ? String(data.get("image_value")) :
      source === "upload" ? previewUrl ?? submission.existingImageUrl : null;
    const operation: RecipeSaveOperation = {
      key, revision: crypto.randomUUID(), recipeId: submission.recipeId, data, imageFile: submission.imageFile, previewUrl,
      recipe: recipeFromDraft(data, submission.recipeId ?? key, imageUrl),
      status: "saving", error: null,
    };
    update([operation, ...current.current.filter(item => item.key !== key && item.key !== submission.draftKey)]);

    // Yield before compression so the immediate update and navigation can paint.
    window.setTimeout(() => { void run(operation); }, 0);
    return { error: null };
  }

  async function run(operation: RecipeSaveOperation) {
    if (!mounted.current || !current.current.includes(operation)) return;
    try {
      // The upload helper mutates its FormData; retain the original for recovery.
      const data = new FormData();
      operation.data.forEach((value, name) => data.append(name, value));
      const result = await saveRecipeWithImage(operation.recipeId, locale, data, operation.imageFile, key => errors(key));
      if (!mounted.current || !current.current.includes(operation)) return;
      if (result.error !== null) {
        update(current.current.map(item => item.key === operation.key ? { ...item, recipeId: result.existingRecipeId ?? item.recipeId, status: "failed", error: result.error } : item));
      } else {
        update(current.current.map(item => item.key === operation.key ? {
          ...item, status: "saved", recipe: result.recipe, imageFile: null, previewUrl: null,
        } : item));
      }
    } catch {
      if (!mounted.current || !current.current.includes(operation)) return;
      update(current.current.map(item => item.key === operation.key ? { ...item, status: "failed", error: errors("saveFailed") } : item));
    }
    if (mounted.current) router.refresh();
  }

  function enqueueDelete(recipe: RecipeCard) {
    if (current.current.some(operation => operation.recipe.id === recipe.id && operation.status === "saving") ||
      currentDeletes.current.some(operation => operation.recipe.id === recipe.id && operation.status !== "failed")) return false;
    const operation: RecipeDeleteOperation = { recipe, status: "deleting", error: null };
    updateDeletes([operation, ...currentDeletes.current.filter(item => item.recipe.id !== recipe.id)]);
    window.setTimeout(() => { void runDelete(operation); }, 0);
    return true;
  }

  async function runDelete(operation: RecipeDeleteOperation) {
    if (!mounted.current || !currentDeletes.current.includes(operation)) return;
    let error: string | null;
    try {
      error = (await deleteRecipe(operation.recipe.id, locale)).error;
    } catch {
      error = errors("deleteFailed");
    }
    if (error) {
      try {
        if (await confirmRecipeDeleted(operation.recipe.id)) error = null;
      } catch {
        // Failed verification is not evidence that deletion succeeded.
      }
    }
    if (!mounted.current || !currentDeletes.current.includes(operation)) return;
    if (!error) update(current.current.filter(item => item.recipe.id !== operation.recipe.id));
    updateDeletes(currentDeletes.current.map(item => item === operation
      ? { ...item, status: error ? "failed" : "deleted", error } : item));
    router.refresh();
  }

  return (
    <Context.Provider value={{ operations, deletions, enqueue, enqueueDelete, reconcile }}>
      {deletions.filter(operation => operation.status === "failed").map(operation => (
        <div className="my-3 rounded-lg border border-destructive p-4" role="alert" key={operation.recipe.id}>
          <p className="text-sm text-destructive">{operation.recipe.name}: {operation.error}</p>
          <Button className="mt-2" variant="outline" onClick={() => enqueueDelete(operation.recipe)}>{t("retryDelete")}</Button>
        </div>
      ))}
      {operations.filter(operation => operation.status === "failed").map(operation => (
        <div className="my-3 rounded-lg border border-destructive p-4" role="alert" key={operation.key}>
          <p className="text-sm text-destructive">{operation.recipe.name}: {operation.error}</p>
          <Button className="mt-2" variant="outline" onClick={() => {
            const path = operation.recipeId ? `/${locale}/recipes/${operation.recipeId}/edit` : `/${locale}/recipes/new`;
            router.push(`${path}?draft=${encodeURIComponent(operation.key)}`);
          }}>{t("editDraft")}</Button>
        </div>
      ))}
      {children}
    </Context.Provider>
  );
}

"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { deleteRecipe } from "@/lib/recipes/actions";
import { mutationIsReflected, recipeFromDraft, type RecipeDraft, type RecipeMutation } from "@/lib/recipes/optimistic";
import { saveWithImage } from "@/lib/recipes/save-with-image";
import type { Recipe } from "@/lib/recipes/types";
import { createClient } from "@/lib/supabase/client";

type MutationsContext = {
  accountVersion: number;
  cachedRecipes: Record<string, Recipe>;
  rememberRecipes: (recipes: Recipe[]) => void;
  mutations: RecipeMutation[];
  newRecipeFormVersion: number;
  save: (draft: RecipeDraft, recoveredKey?: string) => boolean;
  remove: (id: string) => void;
  reconcile: (recipes: Recipe[]) => void;
  isPending: (id: string | null) => boolean;
};

const Context = createContext<MutationsContext | null>(null);

/** Read shared recipe changes and the functions that start or settle them. */
export function useRecipeMutations() {
  const context = useContext(Context);
  if (!context) throw new Error("RecipeMutationProvider is missing");
  return context;
}

/**
 * Keep requests and failed drafts alive across page navigation.
 * Show changes immediately, then keep saved results until server cards catch up.
 */
export function RecipeMutationProvider({ children }: { children: React.ReactNode }) {
  const [accountVersion, setAccountVersion] = useState(0);
  const [cachedRecipes, setCachedRecipes] = useState<Record<string, Recipe>>({});
  const rememberRecipes = useCallback((recipes: Recipe[]) => {
    setCachedRecipes(Object.fromEntries(recipes.map(recipe => [recipe.id, recipe])));
  }, []);
  const [mutations, setMutations] = useState<RecipeMutation[]>([]);
  const [newRecipeFormVersion, setNewRecipeFormVersion] = useState(0);
  // Synchronous ownership prevents double submissions before React rerenders.
  const current = useRef<RecipeMutation[]>([]);
  // A changed generation makes results from a previous login/provider irrelevant.
  const generation = useRef(0);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Recipe");
  const errors = useTranslations("Errors");

  /** Update the immediate duplicate-submit guard and the rendered UI together. */
  const publish = useCallback((next: RecipeMutation[]) => {
    current.current = next;
    setMutations(next);
  }, []);

  /** Dismiss a failed operation and release its stored image preview. */
  const discard = useCallback((key: string) => {
    const mutation = current.current.find(item => item.key === key);
    if (mutation?.previewUrl) URL.revokeObjectURL(mutation.previewUrl);
    publish(current.current.filter(item => item.key !== key));
  }, [publish]);

  useEffect(() => {
    let userId: string | null | undefined;
    // Ignore unfinished work after an account change or provider unmount.
    const invalidate = () => { generation.current++; };
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      const nextId = session?.user.id ?? null;
      if (userId !== undefined && userId !== nextId) {
        invalidate();
        for (const item of current.current) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        publish([]);
        setCachedRecipes({});
        setAccountVersion(version => version + 1);
      }
      userId = nextId;
    });
    return () => {
      subscription.unsubscribe();
      invalidate();
      for (const item of current.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [publish]);

  /** Refresh on arrival if a request finished before navigation reached the list. */
  const refreshAfterNavigation = useCallback(() => {
    if (current.current.some(item => item.status !== "pending")) {
      router.refresh();
    }
  }, [router]);

  /** Block another change until this request fails or its saved result is reconciled. */
  // A null ID represents the new-recipe form; only one create can be outstanding.
  function isPending(id: string | null) {
    return current.current.some(item => item.recipeId === id && item.status !== "failed");
  }

  /** Store success/failure and request fresh server data without navigating again. */
  function finish(key: string, update: Partial<RecipeMutation>) {
    const operation = current.current.find(item => item.key === key);
    if (update.status === "saved") {
      setCachedRecipes(previous => {
        const next = { ...previous };
        if (operation?.kind === "delete" && operation.recipeId) delete next[operation.recipeId];
        if (update.recipe) next[update.recipe.id] = update.recipe;
        return next;
      });
    }
    publish(current.current.map(item => item.key === key ? { ...item, ...update } : item));
    router.refresh();
  }

  /** Show a draft and navigate now; upload/save asynchronously. False means already busy. */
  function save(draft: RecipeDraft, recoveredKey?: string) {
    const recipeId = draft.original?.id ?? null;
    if (isPending(recipeId)) return false;
    if (recoveredKey) discard(recoveredKey);
    const key = crypto.randomUUID();
    const previewUrl = draft.imageFile ? URL.createObjectURL(draft.imageFile) : undefined;
    const imageUrl = previewUrl ?? (draft.data.get("image_source") === "preset"
      ? String(draft.data.get("image_value"))
      : draft.data.get("image_source") === "upload" ? draft.original?.image_url ?? null : null);
    const operation: RecipeMutation = {
      key, recipeId, kind: "save", status: "pending", draft, previewUrl,
      recipe: recipeFromDraft(draft, recipeId ?? key, imageUrl),
    };
    publish([...current.current, operation]);
    const startedIn = generation.current;
    // The image workflow checks this before starting more work.
    const isCurrent = () => generation.current === startedIn;
    router.push(`/${locale}`);
    // Navigation is dispatched before compression or a Server Action starts.
    void (async () => {
      try {
        const result = await saveWithImage(draft, locale, errors, isCurrent);
        if (!isCurrent()) return;
        if (result.error !== null) {
          finish(key, { status: "failed", error: result.error });
        } else {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          // Reset cached new-recipe forms, including their tags and image state.
          if (recipeId === null) setNewRecipeFormVersion(version => version + 1);
          finish(key, { status: "saved", recipe: result.recipe, draft: undefined, previewUrl: undefined });
        }
      } catch {
        if (isCurrent()) finish(key, { status: "failed", error: errors("saveUnconfirmed") });
      }
    })();
    return true;
  }

  /** Hide a recipe immediately, then delete it; failures let the server card reappear. */
  function remove(id: string) {
    if (isPending(id)) return;
    const key = crypto.randomUUID();
    const startedIn = generation.current;
    publish([...current.current, { key, recipeId: id, kind: "delete", status: "pending" }]);
    router.push(`/${locale}`);
    void (async () => {
      try {
        const result = await deleteRecipe(id, locale);
        if (generation.current !== startedIn) return;
        finish(key, result.error
          ? { status: "failed", error: result.error }
          : { status: "saved" });
      } catch {
        if (generation.current === startedIn) finish(key, { status: "failed", error: errors("deleteUnconfirmed") });
      }
    })();
  }

  /** Drop confirmed overlays only once the refreshed list reflects them. Keep failed drafts. */
  const reconcile = useCallback((recipes: Recipe[]) => {
    const next = current.current.filter(item => !mutationIsReflected(item, recipes));
    if (next.length !== current.current.length) publish(next);
  }, [publish]);

  return (
    <Context.Provider value={{ accountVersion, cachedRecipes, rememberRecipes, mutations, newRecipeFormVersion, save, remove, reconcile, isPending }}>
      {children}
      <Suspense fallback={null}>
        <RefreshAfterNavigation home={`/${locale}`} refresh={refreshAfterNavigation} />
      </Suspense>
      <aside className="fixed bottom-20 left-4 right-4 z-50 mx-auto grid max-w-xl gap-2" aria-label={t("activity")}>
        {mutations.some(item => item.kind === "save" && item.status === "pending") && (
          <p className="rounded-lg border bg-background p-3 shadow-lg" role="status">
            {t("saving")}
          </p>
        )}
        {mutations.some(item => item.kind === "delete" && item.status === "pending") && (
          <p className="rounded-lg border bg-background p-3 shadow-lg" role="status">
            {t("deleting")}
          </p>
        )}
        {mutations.filter(item => item.status === "failed").map(item => (
          <div className="rounded-lg border border-destructive bg-background p-3 shadow-lg" key={item.key}>
            <p role="alert">{item.recipe?.name && `${item.recipe.name}: `}{item.error}</p>
            <div className="mt-2 flex gap-4 text-sm">
              {item.draft && (
                <Link className="underline" href={`${item.recipeId ? `/recipes/${item.recipeId}/edit` : "/recipes/new"}?draft=${item.key}`}>
                  {t("returnToForm")}
                </Link>
              )}
              <button className="underline" type="button" onClick={() => discard(item.key)}>{t("dismiss")}</button>
            </div>
          </div>
        ))}
      </aside>
    </Context.Provider>
  );
}

/** Watch arrival at the list without making the whole provider depend on runtime URL data. */
// Cache Components requires runtime URL hooks to have their own boundary.
function RefreshAfterNavigation({ home, refresh }: { home: string; refresh: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === home) refresh();
  }, [pathname, home, refresh]);
  return null;
}

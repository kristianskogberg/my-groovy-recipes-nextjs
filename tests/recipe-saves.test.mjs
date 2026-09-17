import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    console: { error() {} },
    crypto: globalThis.crypto,
    ...globals,
  });
  return exports;
}

const {
  validateRecipeDraft,
  recipeFromDraft,
  mergeRecipeCards,
  matchesRecipeCard,
  recipeFormKey,
} = load("../lib/recipes/optimistic.ts");
function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "Soup",
    servings: "2",
    ...values,
  }))
    data.set(key, value);
  return data;
}
function operation(id, status = "saving", recipeId = null) {
  const data = form();
  return {
    key: id,
    revision: "attempt-1",
    recipeId,
    status,
    data,
    recipe: recipeFromDraft(data, id, null),
    imageFile: null,
    previewUrl: null,
    error: null,
  };
}

test("validation rejects bad fields before upload and accepts optional blanks/zero", () => {
  assert.equal(validateRecipeDraft(form({ name: " " }), null), "invalidRecipe");
  for (const servings of ["", "0", "-1", "Infinity", "NaN"]) {
    assert.equal(
      validateRecipeDraft(form({ servings }), null),
      "invalidRecipe",
    );
  }
  for (const time_minutes of ["-1", "1.5", "Infinity"]) {
    assert.equal(
      validateRecipeDraft(form({ time_minutes }), null),
      "invalidNumbers",
    );
  }
  assert.equal(
    validateRecipeDraft(
      form({ time_minutes: "0", calories_per_serving: "" }),
      null,
    ),
    null,
  );
  assert.equal(
    validateRecipeDraft(form({ image_source: "upload" }), null),
    "imageRequired",
  );
  assert.equal(
    validateRecipeDraft(form({ image_source: "upload" }), {
      type: "image/gif",
      size: 1,
    }),
    "invalidImageType",
  );
  assert.equal(
    validateRecipeDraft(form({ image_source: "upload" }), {
      type: "image/png",
      size: 11 * 1024 * 1024,
    }),
    "imageTooLarge",
  );
});

test("first create appears immediately, including its local preview", () => {
  const pending = operation("pending-new");
  pending.recipe.image_url = "blob:preview";
  const rows = mergeRecipeCards([], [pending]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipe.image_url, "blob:preview");
  assert.equal(rows[0].pending, true);
});

test("edit overlays in place; failure restores the server entry without altering the draft", () => {
  const edit = operation("existing", "saving", "existing");
  const original = { ...edit.recipe, name: "Original" };
  assert.equal(mergeRecipeCards([original], [edit])[0].recipe.name, "Soup");
  edit.status = "failed";
  assert.equal(mergeRecipeCards([original], [edit])[0].recipe.name, "Original");
  assert.equal(edit.data.get("name"), "Soup");
  assert.equal(mergeRecipeCards([], [operation("new", "failed")]).length, 0);
});

test("saved overlay bridges stale props and deduplicates the canonical server row", () => {
  const saved = operation("real-id", "saved");
  assert.equal(mergeRecipeCards([], [saved]).length, 1);
  const stale = { ...saved.recipe, name: "Old name" };
  assert.equal(matchesRecipeCard(stale, saved.recipe), false);
  assert.equal(mergeRecipeCards([stale], [saved])[0].recipe.name, "Soup");
  assert.equal(mergeRecipeCards([saved.recipe], [saved]).length, 1);
  assert.equal(
    matchesRecipeCard({ ...saved.recipe, servings: "2" }, saved.recipe),
    true,
  );
  assert.equal(
    matchesRecipeCard(
      { ...saved.recipe, image_value: "different.jpg" },
      saved.recipe,
    ),
    false,
  );
});

test("independent operations retain their own pending/failure states", () => {
  const rows = mergeRecipeCards(
    [],
    [operation("a", "saved"), operation("b"), operation("c", "failed")],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.recipe.id === "a").pending, false);
  assert.equal(rows.find((row) => row.recipe.id === "b").pending, true);
});

function uploadHarness({
  saveError = null,
  lostResponse = false,
  compressionFailure = false,
  uploadError = null,
  jpegFallback = false,
} = {}) {
  const calls = { saves: 0, uploads: 0, cleanups: 0, compression: [] };
  const saved = operation("real-id", "saved").recipe;
  const { saveRecipeWithImage } = load("../lib/recipes/save-with-image.ts", {
    "@/lib/recipes/actions": {
      saveRecipe: async (_id, _locale, _state, data) => {
        calls.saves++;
        if (lostResponse) throw new Error("Connection lost");
        return saveError
          ? { error: saveError }
          : {
              error: null,
              recipe: { ...saved, image_value: data.get("image_value") },
            };
      },
      cleanupUnusedRecipeImage: async () => {
        calls.cleanups++;
        return true;
      },
    },
    "@/lib/recipes/storage": { RECIPE_IMAGES_BUCKET: "recipe-images" },
    "@/lib/supabase/client": {
      createClient: () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "owner" } },
            error: null,
          }),
        },
        storage: {
          from: () => ({
            upload: async () => {
              calls.uploads++;
              return { error: uploadError };
            },
          }),
        },
      }),
    },
    "browser-image-compression": async (_file, options) => {
      calls.compression.push(options.fileType);
      if (compressionFailure) throw new Error("Compression failed");
      return {
        type:
          jpegFallback && options.fileType === "image/webp"
            ? "image/png"
            : options.fileType,
        size: 100,
      };
    },
  });
  return {
    calls,
    save: (
      data = form({ image_source: "upload" }),
      file = { type: "image/png", size: 100 },
    ) => saveRecipeWithImage(null, "en", data, file, (key) => key),
  };
}

test("upload uses JPEG fallback and returns canonical recipe", async () => {
  const harness = uploadHarness({ jpegFallback: true });
  const data = form({ image_source: "upload" });
  const result = await harness.save(data);
  assert.equal(result.recipe.id, "real-id");
  assert.equal(harness.calls.compression.join(","), "image/webp,image/jpeg");
  assert.match(data.get("image_value"), /^owner\/.+\.jpg$/);
  assert.equal(data.get("image_changed"), "true");
  assert.equal(harness.calls.cleanups, 0);
});

test("definitive save error cleans up upload; lost response preserves it without retry", async () => {
  const failed = uploadHarness({ saveError: "Rejected" });
  assert.equal((await failed.save()).error, "Rejected");
  assert.equal(failed.calls.cleanups, 1);
  const uncertain = uploadHarness({ lostResponse: true });
  assert.equal((await uncertain.save()).error, "saveFailed");
  assert.equal(uncertain.calls.cleanups, 0);
  assert.equal(uncertain.calls.saves, 1);
});

test("compression and upload failures never save a recipe", async () => {
  const compression = uploadHarness({ compressionFailure: true });
  assert.equal((await compression.save()).error, "imageCompressionFailed");
  assert.equal(compression.calls.saves, 0);
  const upload = uploadHarness({ uploadError: { message: "Offline" } });
  assert.equal((await upload.save()).error, "imageUploadFailed Offline");
  assert.equal(upload.calls.saves, 0);
});

test("no image, preset, unchanged upload, and removal skip uploading", async () => {
  for (const values of [
    {},
    { image_source: "preset", image_value: "/preset.jpg" },
    {
      image_source: "upload",
      image_value: "owner/existing.jpg",
      image_changed: "false",
    },
    { image_source: "", image_value: "", image_changed: "true" },
  ]) {
    const harness = uploadHarness();
    const data = form(values);
    assert.equal((await harness.save(data, null)).error, null);
    assert.equal(harness.calls.uploads, 0);
    assert.equal(harness.calls.saves, 1);
    assert.equal(data.get("image_value"), values.image_value ?? "");
  }
});

test("recovery remounts retained edit forms and repeated failed attempts", () => {
  const draft = operation("existing", "failed", "existing");
  const normal = recipeFormKey("existing", undefined, 1);
  const recovery = recipeFormKey("existing", draft, 1);
  assert.notEqual(normal, recovery);
  assert.notEqual(
    recovery,
    recipeFormKey("existing", { ...draft, revision: "attempt-2" }, 1),
  );
});

test("delete hides stale rows and save overlays, then restores a failed deletion", () => {
  const saved = operation("existing", "saved", "existing");
  const deletion = { recipe: saved.recipe, status: "deleting", error: null };
  assert.equal(mergeRecipeCards([saved.recipe], [saved], [deletion]).length, 0);
  assert.equal(
    mergeRecipeCards([saved.recipe], [], [{ ...deletion, status: "deleted" }])
      .length,
    0,
  );
  const failed = { ...deletion, status: "failed", error: "Offline" };
  assert.equal(mergeRecipeCards([], [], [failed])[0].recipe.id, "existing");
  assert.equal(mergeRecipeCards([saved.recipe], [], [failed]).length, 1);
});

function actionHarness({ deleteError = null, cleanupFailures = 0 } = {}) {
  const rows = new Map();
  const events = [];
  let removes = 0;
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: "owner" } }, error: null }),
    },
    from: () => {
      let mode = "read",
        values;
      const filters = {};
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          filters[key] = value;
          return query;
        },
        insert(value) {
          mode = "insert";
          values = value;
          return query;
        },
        delete() {
          mode = "delete";
          return query;
        },
        update(value) {
          mode = "update";
          values = value;
          return query;
        },
        single() {
          return execute();
        },
        maybeSingle() {
          return execute();
        },
        then(resolve, reject) {
          return execute().then(resolve, reject);
        },
      };
      async function execute() {
        if (mode === "insert") {
          events.push("insert");
          if (rows.has(values.id))
            return { data: null, error: { code: "23505" } };
          rows.set(values.id, values);
          return { data: values, error: null };
        }
        const row = rows.get(filters.id);
        const owned = row?.user_id === filters.user_id ? row : null;
        if (mode === "update") {
          if (!owned) return { data: null, error: { message: "Not found" } };
          Object.assign(owned, values);
          return { data: owned, error: null };
        }
        if (mode === "delete") {
          events.push("delete");
          if (deleteError)
            return { data: null, error: { message: deleteError } };
          if (owned) rows.delete(filters.id);
          return { data: owned ? [{ id: owned.id }] : [], error: null };
        }
        return { data: owned, error: null };
      }
      return query;
    },
    storage: {
      from: () => ({
        remove: async () => {
          events.push("cleanup");
          return {
            error:
              removes++ < cleanupFailures
                ? new Error("Storage unavailable")
                : null,
          };
        },
      }),
    },
  };
  const actions = load("../lib/recipes/actions.ts", {
    "@/lib/recipes/presets": { getPresetRecipeImages: async () => [] },
    "@/lib/recipes/storage": {
      RECIPE_IMAGES_BUCKET: "recipe-images",
      getUploadedRecipeImageUrl: (_storage, path) => path,
    },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "next/cache": { revalidatePath: () => {} },
    "next-intl/server": { getTranslations: async () => (key) => key },
  });
  return { ...actions, rows, events };
}

test("replayed creates return the same owned row without overwriting later edits", async () => {
  const harness = actionHarness();
  const id = crypto.randomUUID();
  const data = form({ creation_id: id });
  const first = await harness.saveRecipe(null, "en", { error: null }, data);
  assert.equal(first.recipe.id, id);
  const replay = await harness.saveRecipe(null, "en", { error: null }, data);
  assert.equal(replay.recipe.id, id);
  assert.equal(replay.recipe.name, "Soup");
  harness.rows.get(id).name = "Later edit";
  const conflict = await harness.saveRecipe(null, "en", { error: null }, data);
  assert.equal(conflict.error, "creationConflict");
  assert.equal(conflict.existingRecipeId, id);
  assert.equal(harness.rows.get(id).name, "Later edit");
  assert.equal(harness.rows.size, 1);
  harness.rows.get(id).user_id = "another-owner";
  assert.equal(
    (await harness.saveRecipe(null, "en", { error: null }, data)).error,
    "saveFailed",
  );
});

test("database delete failure preserves the image and recipe", async () => {
  const harness = actionHarness({ deleteError: "Database unavailable" });
  harness.rows.set("id", {
    id: "id",
    user_id: "owner",
    image_value: "owner/photo.jpg",
  });
  assert.equal(
    (await harness.deleteRecipe("id", "en")).error,
    "Database unavailable",
  );
  assert.equal(harness.rows.size, 1);
  assert.deepEqual(harness.events, ["delete"]);
});

test("deletion commits before cleanup, retries storage failures, and is replayable", async () => {
  const harness = actionHarness({ cleanupFailures: 2 });
  harness.rows.set("id", {
    id: "id",
    user_id: "owner",
    image_value: "owner/photo.jpg",
  });
  assert.equal((await harness.deleteRecipe("id", "en")).error, null);
  assert.deepEqual(harness.events, ["delete", "cleanup", "cleanup", "cleanup"]);
  assert.equal(harness.rows.size, 0);
  assert.equal((await harness.deleteRecipe("id", "en")).error, null);
  assert.equal(harness.events.length, 4);
});

test("persistent storage failures do not report a committed deletion as failed", async () => {
  const harness = actionHarness({ cleanupFailures: 10 });
  harness.rows.set("id", {
    id: "id",
    user_id: "owner",
    image_value: "owner/photo.jpg",
  });
  assert.equal((await harness.deleteRecipe("id", "en")).error, null);
  assert.equal(harness.rows.size, 0);
  assert.equal(harness.events.length, 4);
});

// Exercise provider orchestration with deterministic hooks and deferred requests.
// Browser navigation/React reconciliation still require a browser smoke test.
function providerHarness({ save, remove, confirm = async () => false } = {}) {
  const slots = [],
    timers = [];
  let cursor = 0;
  const hooks = {
    createContext: () => ({ Provider: "provider" }),
    useCallback: (callback) => callback,
    useEffect: () => {},
    useRef: (initial) => {
      const index = cursor++;
      return (slots[index] ??= { current: initial });
    },
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value) => {
          slots[index] = value;
        },
      ];
    },
  };
  const jsx = (type, props) => ({ type, props });
  const optimistic = load("../lib/recipes/optimistic.ts");
  const { RecipeSaveProvider } = load(
    "../components/recipe-save-provider.tsx",
    {
      react: hooks,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "next-intl": {
        useLocale: () => "en",
        useTranslations: () => (key) => key,
      },
      "next/navigation": { useRouter: () => ({ refresh() {} }) },
      "@/components/ui/button": { Button: "button" },
      "@/lib/recipes/actions": {
        deleteRecipe: remove,
        confirmRecipeDeleted: confirm,
      },
      "@/lib/recipes/save-with-image": { saveRecipeWithImage: save },
      "@/lib/supabase/client": {},
      "@/lib/recipes/optimistic": optimistic,
    },
    { FormData, window: { setTimeout: (callback) => timers.push(callback) } },
  );
  return {
    context() {
      cursor = 0;
      return RecipeSaveProvider({ children: null }).props.value;
    },
    async flush() {
      timers.splice(0).forEach((callback) => callback());
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test("provider retains deletion over stale props until absence is confirmed", async () => {
  let complete;
  const request = new Promise((resolve) => {
    complete = resolve;
  });
  const harness = providerHarness({ remove: () => request });
  const recipe = operation("existing").recipe;
  assert.equal(harness.context().enqueueDelete(recipe), true);
  assert.equal(harness.context().enqueueDelete(recipe), false);
  assert.equal(harness.context().deletions[0].status, "deleting");
  await harness.flush();
  harness.context().reconcile([]);
  assert.equal(harness.context().deletions.length, 1);
  complete({ error: null });
  await harness.flush();
  assert.equal(harness.context().deletions[0].status, "deleted");
  harness.context().reconcile([recipe]);
  assert.equal(harness.context().deletions.length, 1);
  harness.context().reconcile([]);
  assert.equal(harness.context().deletions.length, 0);
});

test("provider restores deletion failures and allows retry after thrown responses", async () => {
  let attempts = 0;
  const harness = providerHarness({
    remove: async () => {
      if (attempts++ === 0) throw new Error("Offline");
      return { error: null };
    },
  });
  const recipe = operation("existing").recipe;
  harness.context().enqueueDelete(recipe);
  await harness.flush();
  assert.equal(harness.context().deletions[0].status, "failed");
  assert.equal(
    mergeRecipeCards([], [], harness.context().deletions)[0].recipe.id,
    recipe.id,
  );
  assert.equal(harness.context().enqueueDelete(recipe), true);
  await harness.flush();
  assert.equal(harness.context().deletions[0].status, "deleted");
});

test("provider reuses creation identity across recovery and changes draft revision", async () => {
  const ids = [];
  const harness = providerHarness({
    save: async (_id, _locale, data) => {
      ids.push(data.get("creation_id"));
      return { error: "Response lost" };
    },
  });
  const submission = {
    data: form(),
    recipeId: null,
    imageFile: null,
    existingImageUrl: null,
  };
  harness.context().enqueue(submission);
  const first = harness.context().operations[0];
  assert.equal(first.recipe.id, first.data.get("creation_id"));
  assert.equal(harness.context().enqueueDelete(first.recipe), false);
  await harness.flush();
  harness.context().enqueue({ ...submission, draftKey: first.key });
  const second = harness.context().operations[0];
  assert.equal(first.key, second.key);
  assert.notEqual(first.revision, second.revision);
  await harness.flush();
  assert.deepEqual(ids, [first.key, first.key]);
});

test("edited create recovery preserves the draft and requires an explicit update", async () => {
  const h = actionHarness(),
    id = crypto.randomUUID();
  await h.saveRecipe(null, "en", { error: null }, form({ creation_id: id }));
  const edited = form({
    creation_id: id,
    name: "New name",
    ingredients: "More garlic",
  });
  const conflict = await h.saveRecipe(null, "en", { error: null }, edited);
  assert.equal(conflict.error, "creationConflict");
  assert.equal(conflict.existingRecipeId, id);
  assert.equal(h.rows.get(id).name, "Soup");
  const updated = await h.saveRecipe(
    conflict.existingRecipeId,
    "en",
    { error: null },
    edited,
  );
  assert.equal(updated.recipe.name, "New name");
  assert.equal(updated.recipe.ingredients[0], "More garlic");
  assert.equal(h.rows.size, 1);
});

test("provider routes conflicted creations to edit recovery with their revised content", async () => {
  const h = providerHarness({
    save: async () => ({
      error: "creationConflict",
      existingRecipeId: "existing",
    }),
  });
  const draft = form({ name: "Revised draft", steps: "Keep this step" });
  assert.equal(
    h
      .context()
      .enqueue({
        data: draft,
        recipeId: null,
        imageFile: null,
        existingImageUrl: null,
      }).error,
    null,
  );
  await h.flush();
  const failed = h.context().operations[0];
  assert.equal(failed.status, "failed");
  assert.equal(failed.recipeId, "existing");
  assert.equal(failed.data.get("name"), "Revised draft");
  assert.equal(failed.recipe.steps[0], "Keep this step");
});

test("lost delete response is confirmed before restoring a ghost", async () => {
  const h = providerHarness({
    remove: async () => {
      throw Error("Lost response");
    },
    confirm: async () => true,
  });
  const recipe = operation("gone").recipe;
  h.context().enqueueDelete(recipe);
  await h.flush();
  assert.equal(h.context().deletions[0].status, "deleted");
  assert.equal(mergeRecipeCards([recipe], [], h.context().deletions).length, 0);
  h.context().reconcile([]);
  assert.equal(h.context().deletions.length, 0);
});

test("refresh rechecks uncertain deletion without trusting stale absent props", async () => {
  let deleted = false,
    checks = 0;
  const h = providerHarness({
    remove: async () => {
      throw Error("Offline");
    },
    confirm: async () => {
      checks++;
      return deleted;
    },
  });
  h.context().enqueueDelete(operation("gone").recipe);
  await h.flush();
  const stale = [];
  h.context().reconcile(stale);
  await h.flush();
  assert.equal(h.context().deletions[0].status, "failed");
  const previousChecks = checks;
  h.context().reconcile(stale);
  await h.flush();
  assert.equal(checks, previousChecks);
  deleted = true;
  const fresh = [];
  h.context().reconcile(fresh);
  await h.flush();
  assert.equal(h.context().deletions[0].status, "deleted");
  h.context().reconcile(fresh);
  assert.equal(h.context().deletions.length, 0);
});

test("deletion verification failure retains a recoverable error", async () => {
  const h = providerHarness({
    remove: async () => {
      throw Error("Offline");
    },
    confirm: async () => {
      throw Error("Offline");
    },
  });
  h.context().enqueueDelete(operation("existing").recipe);
  await h.flush();
  h.context().reconcile([]);
  await h.flush();
  assert.equal(h.context().deletions[0].status, "failed");
});

test("save rejection returns an error without altering the submission", () => {
  const h = providerHarness();
  h.context().enqueueDelete(operation("existing").recipe);
  const data = form({ name: "Keep my input" });
  const result = h
    .context()
    .enqueue({
      data,
      recipeId: "existing",
      imageFile: null,
      existingImageUrl: null,
    });
  assert.equal(result.error, "saveDuringDelete");
  assert.equal(data.get("name"), "Keep my input");
  assert.equal(h.context().operations.length, 0);
});

test("server verification distinguishes existing and deleted recipes", async () => {
  const h = actionHarness();
  h.rows.set("existing", { id: "existing", user_id: "owner" });
  assert.equal(await h.confirmRecipeDeleted("existing"), false);
  assert.equal(await h.confirmRecipeDeleted("gone"), true);
});

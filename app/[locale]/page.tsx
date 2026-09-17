import { RecipeListClient } from "@/components/recipe-list-client";
import { RecipeList } from "@/components/recipe-list";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("Home");

  return (
    <main className="flex-1 pb-24 sm:pb-0">
      <AppHeader brandAsHeading locale={locale} />

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold h-11 items-center flex">
            {t("yourRecipes")}
          </h2>
          <Button
            asChild
            className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 h-11 sm:static"
            icon={<Plus />}
          >
            <Link href="/recipes/new">{t("newRecipe")}</Link>
          </Button>
        </div>
        <Suspense fallback={<RecipeListClient loading />}>
          <RecipeList />
        </Suspense>
      </section>
    </main>
  );
}

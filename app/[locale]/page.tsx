import { AuthButton } from "@/components/auth-button";
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
      <AppHeader brandAsHeading locale={locale}>
        <AuthButton />
      </AppHeader>

      <Button
        asChild
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 h-11 sm:static sm:mt-8 sm:h-9"
        icon={<Plus />}
      >
        <Link href="/recipes/new">{t("newRecipe")}</Link>
      </Button>

      <section className="mt-8 grid gap-4">
        <h2 className="text-2xl font-bold">{t("yourRecipes")}</h2>
        <Suspense fallback={<p>{t("loading")}</p>}>
          <RecipeList />
        </Suspense>
      </section>
    </main>
  );
}

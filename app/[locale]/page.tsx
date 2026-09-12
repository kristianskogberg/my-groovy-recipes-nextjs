import { AuthButton } from "@/components/auth-button";
import { AppBrand } from "@/components/app-brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RecipeList } from "@/components/recipe-list";
import { Link } from "@/i18n/navigation";
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
    <main className="min-h-svh p-4 sm:p-6">
      <header className="flex items-center justify-between gap-4">
        <h1>
          <AppBrand locale={locale} />
        </h1>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Suspense fallback={null}>
            <AuthButton />
          </Suspense>
        </div>
      </header>

      <Link
        className="mt-8 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        href="/recipes/new"
      >
        {t("newRecipe")}
      </Link>

      <section className="mt-8 grid gap-4">
        <h2 className="text-2xl font-bold">{t("yourRecipes")}</h2>
        <Suspense fallback={<p>{t("loading")}</p>}>
          <RecipeList />
        </Suspense>
      </section>
    </main>
  );
}

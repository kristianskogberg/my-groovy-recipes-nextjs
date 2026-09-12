import { AppBrand } from "@/components/app-brand";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Suspense } from "react";

export default async function RecipesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="min-h-svh p-4 sm:p-6">
      <header className="mb-8 flex items-center justify-between">
        <AppBrand locale={locale} />
        <Suspense fallback={null}>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </Suspense>
      </header>
      {children}
    </main>
  );
}

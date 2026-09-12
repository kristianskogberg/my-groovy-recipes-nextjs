import { LogoutButton } from "@/components/logout-button";
import { AppHeader } from "@/components/app-header";

export default async function RecipesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="flex-1">
      <AppHeader locale={locale}>
        <LogoutButton />
      </AppHeader>
      {children}
    </main>
  );
}

import { AppBrand } from "@/components/app-brand";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function AuthLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  return (
    <main className="grid min-h-svh grid-rows-[auto_1fr] p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <AppBrand locale={locale} />
        <LanguageSwitcher />
      </div>
      <div className="flex items-center justify-center">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}

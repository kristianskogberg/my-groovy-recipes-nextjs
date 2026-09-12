import { AppHeader } from "@/components/app-header";

export default async function AuthLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  return (
    <main className="grid flex-1 grid-rows-[auto_1fr]">
      <AppHeader locale={locale} />
      <div className="flex items-center justify-center">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AppFooter } from "@/components/app-footer";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000",
  ),
  title: "My Groovy Recipes",
  description: "Save and discover your favorite recipes",
};

const dmSans = DM_Sans({
  variable: "--font-sans",
  display: "swap",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-heading",
  display: "swap",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages({ locale });

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <script async fetchPriority="high" src="/theme-init.js" />
        <NextIntlClientProvider messages={messages}>
          <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 sm:px-6">
            {children}
            <AppFooter />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

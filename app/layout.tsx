import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${fraunces.variable} font-sans antialiased`}
      >
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </body>
    </html>
  );
}

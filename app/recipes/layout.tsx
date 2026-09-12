import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const instant = false;

export default async function RecipesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect("/auth/login");

  return (
    <main className="min-h-svh p-4 sm:p-6">
      <header className="mb-8 flex items-center justify-between">
        <Link className="font-heading text-xl font-semibold" href="/">
          My Groovy Recipes
        </Link>
        <LogoutButton />
      </header>
      {children}
    </main>
  );
}

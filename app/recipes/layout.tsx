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
    <main className="mx-auto min-h-svh max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <Link className="font-semibold" href="/">
          My Groovy Recipes
        </Link>
        <LogoutButton />
      </header>
      {children}
    </main>
  );
}

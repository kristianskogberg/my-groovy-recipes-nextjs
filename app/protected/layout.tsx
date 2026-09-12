import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const instant = false;

export default async function ProtectedLayout({
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
        <span className="font-semibold">My Groovy Recipes</span>
        <LogoutButton />
      </header>
      {children}
    </main>
  );
}

import { AuthButton } from "@/components/auth-button";
import { RecipeList } from "@/components/recipe-list";
import Link from "next/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="mx-auto min-h-svh max-w-5xl p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My Groovy Recipes</h1>
        <Suspense fallback={null}>
          <AuthButton />
        </Suspense>
      </header>

      <Link
        className="mt-8 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        href="/recipes/new"
      >
        New recipe
      </Link>

      <section className="mt-8 grid gap-4">
        <h2 className="text-2xl font-bold">Your recipes</h2>
        <Suspense fallback={<p>Loading recipes...</p>}>
          <RecipeList />
        </Suspense>
      </section>
    </main>
  );
}

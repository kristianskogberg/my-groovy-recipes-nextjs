import { AuthButton } from "@/components/auth-button";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold">My Groovy Recipes</h1>
      <p>Save and discover your favorite recipes.</p>
      <Suspense fallback={null}>
        <AuthButton />
      </Suspense>
    </main>
  );
}

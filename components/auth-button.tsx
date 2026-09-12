import { Link } from "@/i18n/navigation";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { getTranslations } from "next-intl/server";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;
  const common = await getTranslations("Common");
  const home = await getTranslations("Home");

  return user ? (
    <div className="flex items-center gap-4">
      {home("greeting", { email: String(user.email ?? "") })}
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">{common("login")}</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">{common("signUp")}</Link>
      </Button>
    </div>
  );
}

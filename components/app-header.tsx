import { Suspense } from "react";

import { AppBrand } from "@/components/app-brand";
import { AppFooter } from "@/components/app-footer";
import { AuthButton } from "@/components/auth-button";
import { MobileMenu } from "@/components/mobile-menu";
import { cn } from "@/lib/utils";

export function AppHeader({
  brandAsHeading = false,
  className,
  locale,
}: {
  brandAsHeading?: boolean;
  className?: string;
  locale: string;
}) {
  const brand = <AppBrand locale={locale} />;
  const auth = (
    <Suspense fallback={null}>
      <AuthButton />
    </Suspense>
  );

  return (
    <header
      className={cn("flex items-center justify-between gap-4 py-4", className)}
    >
      <div className="relative z-50">
        {brandAsHeading ? <h1>{brand}</h1> : brand}
      </div>
      <div className="hidden md:block">{auth}</div>
      <MobileMenu
        auth={auth}
        footer={<AppFooter className="mt-auto w-full" />}
      />
    </header>
  );
}

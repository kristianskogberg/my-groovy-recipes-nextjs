import { Suspense } from "react";

import { AppBrand } from "@/components/app-brand";
import { cn } from "@/lib/utils";

export function AppHeader({
  brandAsHeading = false,
  children,
  className,
  locale,
}: {
  brandAsHeading?: boolean;
  children?: React.ReactNode;
  className?: string;
  locale: string;
}) {
  const brand = <AppBrand locale={locale} />;

  return (
    <header
      className={cn("flex items-center justify-between gap-4 py-4", className)}
    >
      {brandAsHeading ? <h1>{brand}</h1> : brand}
      {children && <Suspense fallback={null}>{children}</Suspense>}
    </header>
  );
}

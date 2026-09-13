"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";

export function MobileMenu({
  auth,
  footer,
}: {
  auth: React.ReactNode;
  footer: React.ReactNode;
}) {
  const t = useTranslations("Common");
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    desktop.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="shrink-0 md:hidden">
      <Button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-label={t(isOpen ? "closeMenu" : "openMenu")}
        className="relative z-50 size-11 [&_svg]:size-6"
        icon={isOpen ? <X /> : <Menu />}
        onClick={() => setIsOpen((open) => !open)}
        size="icon"
        type="button"
        variant="ghost"
      />
      {isOpen && (
        <div
          aria-label={t("menu")}
          aria-modal="true"
          className="fixed inset-0 z-40 flex h-dvh flex-col bg-background pt-[4.5rem] text-foreground md:hidden"
          id={menuId}
          role="dialog"
        >
          <div
            className="flex flex-1 items-center justify-center px-4 [&>div]:flex-col"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a, button")) {
                setIsOpen(false);
              }
            }}
          >
            {auth}
          </div>
          {footer}
        </div>
      )}
    </div>
  );
}

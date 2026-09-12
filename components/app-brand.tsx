import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function AppBrand({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <Link
      className="flex items-center gap-2 font-heading text-xl font-semibold"
      href="/"
    >
      <Image
        alt=""
        className="size-10 object-contain"
        height={40}
        priority
        src="/logo.png"
        width={40}
      />
      <span>{t("appName")}</span>
    </Link>
  );
}

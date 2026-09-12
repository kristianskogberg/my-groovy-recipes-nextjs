import { routing } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const requested = await rootParams.locale();
    if (!hasLocale(routing.locales, requested)) notFound();
    locale = requested;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

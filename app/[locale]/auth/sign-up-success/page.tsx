import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("signUpSuccess")}</CardTitle>
        <CardDescription>{t("confirmEmail")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t("confirmDescription")}
        </p>
      </CardContent>
    </Card>
  );
}

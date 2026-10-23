import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/features/auth/components/register-form/register-form";
import { ROUTES } from "@/shared/lib/routes";
import { AppBar } from "@/shared/ui/app-bar/app-bar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");

  return { title: t("metaTitle") };
}

export default function RegisterPage() {
  const t = useTranslations("auth.register");

  return (
    <main className="flex flex-1 flex-col lg:pt-14">
      <AppBar title={t("title")} backHref={ROUTES.LOGIN} />
      <div className="flex flex-1 flex-col px-5 pt-2 lg:flex-none lg:px-0 lg:pt-6">
        <RegisterForm />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/features/auth/components/login-form/login-form";
import { ROUTES } from "@/shared/lib/routes";
import { BrandLogo } from "@/shared/ui/brand-logo/brand-logo";
import styles from "./page.module.scss";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");

  return { title: t("metaTitle") };
}

export default function LoginPage() {
  const t = useTranslations("auth.login");

  return (
    <main className="flex flex-1 flex-col">
      <header className={`${styles["login-page__hero"]} flex flex-col gap-3 px-5 pt-10 pb-6`}>
        <BrandLogo onDark priority />
        <h1 className={styles["login-page__title"]}>{t("title")}</h1>
        <p className={styles["login-page__subtitle"]}>{t("subtitle")}</p>
      </header>
      <div className="flex flex-1 flex-col gap-6 px-5 pt-5 pb-8">
        <LoginForm />
        <p className={`${styles["login-page__footer"]} mt-auto`}>
          {t("noAccount")}{" "}
          <Link href={ROUTES.REGISTER} className={styles["login-page__register-link"]}>
            {t("registerLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { getServices } from "@/server/container";
import { getSession } from "@/server/session/session";
import { ROUTES } from "@/shared/lib/routes";
import styles from "./page.module.scss";

async function Greeting() {
  const session = await getSession();

  if (!session) {
    redirect(ROUTES.LOGIN);
  }

  const summary = await getServices().wallet.getSummary(session.userId);

  if (!summary.ok) {
    throw new Error(`Wallet summary unavailable: ${summary.error.code}`);
  }

  const t = await getTranslations("home.placeholder");

  return (
    <div className="flex flex-col items-start gap-6">
      <h1 className={styles["home-placeholder__greeting"]}>{t("greeting", { name: summary.value.user.fullName })}</h1>
      <LogoutButton />
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-8 md:px-8">
      <Suspense>
        <Greeting />
      </Suspense>
    </main>
  );
}

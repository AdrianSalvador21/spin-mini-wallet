import { useTranslations } from "next-intl";
import { BrandLogo } from "@/shared/ui/brand-logo/brand-logo";
import styles from "./page.module.scss";

export default function HomePage() {
  const t = useTranslations("common.home");

  return (
    <main
      className={`${styles.landing} flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center`}
    >
      <BrandLogo onDark priority />
      <h1 className={styles.landing__title}>{t("title")}</h1>
      <p className={styles.landing__subtitle}>{t("subtitle")}</p>
    </main>
  );
}

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import styles from "./app-bar.module.scss";

interface AppBarProps {
  title: ReactNode;
  backHref: ComponentProps<typeof Link>["href"];
}

export function AppBar({ title, backHref }: AppBarProps) {
  const t = useTranslations("common.appBar");

  return (
    <header className={styles["app-bar"]}>
      <Link href={backHref} className={styles["app-bar__back"]}>
        <span className={styles["app-bar__back-circle"]}>
          <Icon name={ICON_NAME.BACK} size={ICON_SIZE.SM} />
        </span>
        <span className={styles["app-bar__back-label"]}>{t("back")}</span>
      </Link>
      <h1 className={styles["app-bar__title"]}>{title}</h1>
    </header>
  );
}

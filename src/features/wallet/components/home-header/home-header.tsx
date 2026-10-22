"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { AccountSheet } from "@/features/wallet/components/account-sheet/account-sheet";
import { useWalletSummary } from "@/features/wallet/hooks/use-wallet-summary";
import { formatLongDate } from "@/shared/lib/format/date";
import { getFirstName, getInitials } from "@/shared/lib/format/name";
import { Avatar } from "@/shared/ui/avatar/avatar";
import { AVATAR_SIZE, AVATAR_TONE } from "@/shared/ui/avatar/types";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import styles from "./home-header.module.scss";

interface HomeHeaderProps {
  now: string;
  logoutSlot: ReactNode;
}

export function HomeHeader({ now, logoutSlot }: HomeHeaderProps) {
  const t = useTranslations("home.header");
  const { data, isPending, isError } = useWalletSummary();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isPending) {
    return (
      <header className={styles["home-header"]} aria-hidden="true">
        <div className={styles["home-header__mobile"]}>
          <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.MD} width="50%" />
          <Skeleton shape={SKELETON_SHAPE.CIRCLE} size={SKELETON_SIZE.SM} />
        </div>
        <div className={styles["home-header__desktop"]}>
          <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width="40%" />
          <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.MD} width="30%" />
        </div>
      </header>
    );
  }

  if (isError || !data) {
    return (
      <header className={styles["home-header"]}>
        <p className={styles["home-header__greeting"]}>{t("hello")}</p>
      </header>
    );
  }

  const firstName = getFirstName(data.user.fullName);

  return (
    <header className={styles["home-header"]}>
      <div className={styles["home-header__mobile"]}>
        <p className={styles["home-header__greeting"]}>{t("greeting", { name: firstName })}</p>
        <button
          type={BUTTON_TYPE.BUTTON}
          className={styles["home-header__avatar-button"]}
          aria-label={t("openAccount")}
          onClick={() => setSheetOpen(true)}
        >
          <Avatar initials={getInitials(data.user.fullName)} size={AVATAR_SIZE.TOUCH} tone={AVATAR_TONE.ON_BRAND} />
        </button>
      </div>
      <div className={styles["home-header__desktop"]}>
        <h1 className={styles["home-header__title"]}>{t("greeting", { name: firstName })}</h1>
        <p className={styles["home-header__date"]}>{formatLongDate(now)}</p>
      </div>
      <AccountSheet open={sheetOpen} onClose={() => setSheetOpen(false)} user={data.user} logoutSlot={logoutSlot} />
    </header>
  );
}

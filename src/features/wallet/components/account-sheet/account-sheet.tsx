"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { getInitials } from "@/shared/lib/format/name";
import { Avatar } from "@/shared/ui/avatar/avatar";
import { AVATAR_SIZE, AVATAR_TONE } from "@/shared/ui/avatar/types";
import { BottomSheet } from "@/shared/ui/bottom-sheet/bottom-sheet";
import styles from "./account-sheet.module.scss";

interface AccountSheetUser {
  fullName: string;
  maskedPhone: string;
  email: string;
}

interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
  user: AccountSheetUser;
  logoutSlot: ReactNode;
}

export function AccountSheet({ open, onClose, user, logoutSlot }: AccountSheetProps) {
  const t = useTranslations("home.account");

  return (
    <BottomSheet open={open} onClose={onClose} label={t("title")} closeLabel={t("close")}>
      <div className={styles["account-sheet"]}>
        <Avatar initials={getInitials(user.fullName)} size={AVATAR_SIZE.LG} tone={AVATAR_TONE.SOFT} />
        <p className={styles["account-sheet__name"]}>{user.fullName}</p>
        <p className={styles["account-sheet__detail"]}>{t("phone", { phone: user.maskedPhone })}</p>
        <p className={styles["account-sheet__detail"]}>{user.email}</p>
        <div className={styles["account-sheet__logout"]}>{logoutSlot}</div>
      </div>
    </BottomSheet>
  );
}

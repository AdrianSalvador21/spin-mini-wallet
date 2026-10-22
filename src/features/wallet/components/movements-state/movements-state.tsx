"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_SIZE, type IconName } from "@/shared/ui/icon/types";
import styles from "./movements-state.module.scss";

interface MovementsStateProps {
  icon: IconName;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  requestId?: string;
}

export function MovementsState({ icon, title, text, actionLabel, onAction, requestId }: MovementsStateProps) {
  const tCommon = useTranslations("common");

  return (
    <div className={styles["movements-state"]} role={onAction ? "alert" : undefined}>
      <span className={styles["movements-state__icon"]}>
        <Icon name={icon} size={ICON_SIZE.XL} />
      </span>
      <p className={styles["movements-state__title"]}>{title}</p>
      <p className={styles["movements-state__text"]}>{text}</p>
      {actionLabel && onAction && (
        <Button variant={BUTTON_VARIANT.SECONDARY} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {requestId && <p className={styles["movements-state__reference"]}>{tCommon("reference", { requestId })}</p>}
    </div>
  );
}

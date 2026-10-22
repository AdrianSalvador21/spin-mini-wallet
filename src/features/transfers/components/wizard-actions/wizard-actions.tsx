import type { Route } from "next";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ActionBar } from "@/shared/ui/action-bar/action-bar";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import styles from "./wizard-actions.module.scss";

interface WizardActionsProps {
  backHref: Route;
  backLabel?: ReactNode;
  backOnMobile?: boolean;
  children: ReactNode;
}

export function WizardActions({ backHref, backLabel, backOnMobile = false, children }: WizardActionsProps) {
  const t = useTranslations("transfers.actions");

  return (
    <ActionBar className={styles["wizard-actions"]}>
      <div
        className={[styles["wizard-actions__back"], backOnMobile && styles["wizard-actions__back--mobile"]]
          .filter(Boolean)
          .join(" ")}
      >
        <Button variant={BUTTON_VARIANT.GHOST} href={backHref} className={styles["wizard-actions__back-button"]}>
          {backLabel ?? t("back")}
        </Button>
      </div>
      {children}
    </ActionBar>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { clearClientSession } from "@/shared/lib/session-storage/client-session";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import { logoutAction } from "../../actions";
import styles from "./logout-button.module.scss";
import { type LogoutButtonVariant } from "./types";

interface LogoutSubmitProps {
  variant: LogoutButtonVariant;
}

function LogoutSubmit({ variant }: LogoutSubmitProps) {
  const t = useTranslations("auth.logout");
  const { pending } = useFormStatus();

  return (
    <button
      type={BUTTON_TYPE.SUBMIT}
      disabled={pending}
      aria-busy={pending || undefined}
      className={[styles["logout-button"], styles[`logout-button--${variant}`]].filter(Boolean).join(" ")}
    >
      <Icon name={ICON_NAME.LOGOUT} size={ICON_SIZE.MD} />
      <span className={styles["logout-button__label"]}>{pending ? t("submitting") : t("submit")}</span>
    </button>
  );
}

interface LogoutButtonProps {
  variant: LogoutButtonVariant;
}

export function LogoutButton({ variant }: LogoutButtonProps) {
  return (
    <form action={logoutAction} onSubmit={clearClientSession}>
      <LogoutSubmit variant={variant} />
    </form>
  );
}

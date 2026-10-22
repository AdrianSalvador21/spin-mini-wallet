import type { ReactNode } from "react";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, type IconName } from "@/shared/ui/icon/types";
import styles from "./alert.module.scss";
import { ALERT_TONE, type AlertRole, type AlertTone } from "./types";

function alertIcon(tone: AlertTone): IconName {
  switch (tone) {
    case ALERT_TONE.DANGER:
      return ICON_NAME.ALERT;
    case ALERT_TONE.WARNING:
      return ICON_NAME.CLOCK;
    case ALERT_TONE.SUCCESS:
      return ICON_NAME.CHECK;
    case ALERT_TONE.INFO:
      return ICON_NAME.ALERT;
    default:
      return assertUnreachable(tone);
  }
}

interface AlertProps {
  tone: AlertTone;
  role?: AlertRole;
  className?: string;
  children: ReactNode;
}

export function Alert({ tone, role, className, children }: AlertProps) {
  const classNames = [styles.alert, styles[`alert--${tone}`], className].filter(Boolean).join(" ");

  return (
    <div role={role} className={classNames}>
      <Icon name={alertIcon(tone)} className={styles.alert__icon} />
      <div className={styles.alert__content}>{children}</div>
    </div>
  );
}

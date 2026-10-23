import type { AlertRole } from "@/shared/ui/alert/types";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_SIZE, type IconName } from "@/shared/ui/icon/types";
import { SupportReference } from "@/shared/ui/support-reference/support-reference";
import styles from "./wizard-state.module.scss";

interface WizardStateProps {
  icon: IconName;
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
  requestId?: string;
  role?: AlertRole;
}

export function WizardState({ icon, title, text, actionLabel, onAction, requestId, role }: WizardStateProps) {
  return (
    <div className={styles["wizard-state"]} role={role}>
      <span className={styles["wizard-state__icon"]}>
        <Icon name={icon} size={ICON_SIZE.XL} />
      </span>
      <p className={styles["wizard-state__title"]}>{title}</p>
      {text && <p className={styles["wizard-state__text"]}>{text}</p>}
      {actionLabel && onAction && (
        <Button variant={BUTTON_VARIANT.SECONDARY} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {requestId && <SupportReference requestId={requestId} />}
    </div>
  );
}

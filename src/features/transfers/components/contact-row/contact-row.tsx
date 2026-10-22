import { useAccountLabel } from "@/shared/i18n/use-account-label";
import type { ContactView } from "@/shared/lib/api/views";
import { getInitials } from "@/shared/lib/format/name";
import { Avatar } from "@/shared/ui/avatar/avatar";
import { AVATAR_SIZE, AVATAR_TONE } from "@/shared/ui/avatar/types";
import { INPUT_TYPE } from "@/shared/ui/field/types";
import styles from "./contact-row.module.scss";

interface ContactRowProps {
  contact: ContactView;
  name: string;
  checked: boolean;
  onSelect: (contact: ContactView) => void;
}

export function ContactRow({ contact, name, checked, onSelect }: ContactRowProps) {
  const accountLabel = useAccountLabel();
  const detailId = `${name}-${contact.id}-detail`;

  return (
    <label className={[styles["contact-row"], checked && styles["contact-row--checked"]].filter(Boolean).join(" ")}>
      <input
        type={INPUT_TYPE.RADIO}
        name={name}
        value={contact.id}
        checked={checked}
        onChange={() => onSelect(contact)}
        aria-describedby={detailId}
        className={styles["contact-row__input"]}
      />
      <Avatar initials={getInitials(contact.name)} size={AVATAR_SIZE.TOUCH} tone={AVATAR_TONE.SOFT} />
      <span className={styles["contact-row__text"]}>
        <span className={styles["contact-row__name"]}>{contact.name}</span>
        <span id={detailId} className={styles["contact-row__account"]}>
          {accountLabel(contact.account)}
        </span>
      </span>
      <span className={styles["contact-row__radio"]} aria-hidden="true" />
    </label>
  );
}

import type { ReactNode, Ref } from "react";
import { INPUT_TYPE } from "@/shared/ui/field/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import styles from "./checkbox.module.scss";

interface CheckboxProps {
  label: ReactNode;
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Checkbox({ label, id, checked, onChange, name, ref }: CheckboxProps) {
  return (
    <label htmlFor={id} className={styles.checkbox}>
      <input
        ref={ref}
        id={id}
        name={name}
        type={INPUT_TYPE.CHECKBOX}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={styles.checkbox__input}
      />
      <span className={styles.checkbox__box} aria-hidden="true">
        <Icon name={ICON_NAME.CHECK} size={ICON_SIZE.SM} className={styles.checkbox__check} />
      </span>
      <span className={styles.checkbox__label}>{label}</span>
    </label>
  );
}

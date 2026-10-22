import type { ComponentProps, ReactNode } from "react";
import styles from "./field.module.scss";
import { INPUT_TYPE, type AutoComplete, type InputMode, type InputType } from "./types";

export interface FieldProps
  extends Omit<ComponentProps<"input">, "id" | "prefix" | "type" | "inputMode" | "autoComplete"> {
  label: ReactNode;
  id: string;
  type?: InputType;
  inputMode?: InputMode;
  autoComplete?: AutoComplete;
  prefix?: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

const errorIdOf = (id: string) => `${id}-error`;
const hintIdOf = (id: string) => `${id}-hint`;

function describedById(id: string, hasError: boolean, hasHint: boolean): string | undefined {
  if (hasError) {
    return errorIdOf(id);
  }
  if (hasHint) {
    return hintIdOf(id);
  }
  return undefined;
}

export function Field({
  label,
  id,
  type = INPUT_TYPE.TEXT,
  prefix,
  suffix,
  hint,
  error,
  className,
  ...inputProps
}: FieldProps) {
  const hasError = Boolean(error);
  const hasHint = Boolean(hint);

  const controlClassNames = [styles.field__control, hasError && styles["field__control--error"]]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.field__label}>
        {label}
      </label>
      <div className={controlClassNames}>
        {prefix && <span className={styles.field__prefix}>{prefix}</span>}
        <input
          {...inputProps}
          id={id}
          type={type}
          className={styles.field__input}
          aria-invalid={hasError || undefined}
          aria-describedby={describedById(id, hasError, hasHint)}
        />
        {suffix}
      </div>
      {hasError && (
        <p id={errorIdOf(id)} className={styles.field__error}>
          {error}
        </p>
      )}
      {!hasError && hasHint && (
        <p id={hintIdOf(id)} className={styles.field__hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

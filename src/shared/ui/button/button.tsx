import type { ComponentProps, ReactNode } from "react";
import styles from "./button.module.scss";
import { BUTTON_TYPE, type ButtonType, type ButtonVariant } from "./types";

interface ButtonProps extends Omit<ComponentProps<"button">, "type"> {
  variant: ButtonVariant;
  type?: ButtonType;
  block?: boolean;
  loading?: boolean;
  loadingLabel?: ReactNode;
}

export function Button({
  variant,
  block = false,
  loading = false,
  loadingLabel,
  type = BUTTON_TYPE.BUTTON,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classNames = [
    styles.button,
    styles[`button--${variant}`],
    block && styles["button--block"],
    loading && styles["button--loading"],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classNames}
    >
      {loading && <span className={styles.button__spinner} aria-hidden="true" />}
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}

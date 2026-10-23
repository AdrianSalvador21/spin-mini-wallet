import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./button.module.scss";
import { BUTTON_TYPE, type ButtonType, type ButtonVariant } from "./types";

interface ButtonCommonProps {
  variant: ButtonVariant;
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

interface ButtonAsButtonProps
  extends ButtonCommonProps,
    Omit<ComponentProps<"button">, "type" | "className" | "children"> {
  href?: never;
  type?: ButtonType;
  loading?: boolean;
  loadingLabel?: ReactNode;
}

interface ButtonAsLinkProps extends ButtonCommonProps {
  href: Route;
}

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

function buttonClassNames(variant: ButtonVariant, block: boolean, loading: boolean, className?: string): string {
  return [
    styles.button,
    styles[`button--${variant}`],
    block && styles["button--block"],
    loading && styles["button--loading"],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonProps) {
  if (props.href) {
    const { variant, block = false, className, children, href } = props;

    return (
      <Link href={href} className={buttonClassNames(variant, block, false, className)}>
        {children}
      </Link>
    );
  }

  const {
    variant,
    block = false,
    className,
    children,
    loading = false,
    loadingLabel,
    type = BUTTON_TYPE.BUTTON,
    disabled,
    ...rest
  } = props;

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassNames(variant, block, loading, className)}
    >
      {loading && <span className={styles.button__spinner} aria-hidden="true" />}
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}

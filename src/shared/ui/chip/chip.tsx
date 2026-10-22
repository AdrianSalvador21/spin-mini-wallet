import type { ReactNode } from "react";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import styles from "./chip.module.scss";

interface ChipProps {
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}

export function Chip({ children, onClick, pressed = false, disabled = false }: ChipProps) {
  return (
    <button
      type={BUTTON_TYPE.BUTTON}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={[styles.chip, pressed && styles["chip--pressed"]].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}

import type { ReactNode } from "react";
import styles from "./action-bar.module.scss";

interface ActionBarProps {
  children: ReactNode;
  className?: string;
}

export function ActionBar({ children, className }: ActionBarProps) {
  return <div className={[styles["action-bar"], className].filter(Boolean).join(" ")}>{children}</div>;
}

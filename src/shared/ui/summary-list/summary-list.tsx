import type { ReactNode } from "react";
import styles from "./summary-list.module.scss";

export interface SummaryListItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

interface SummaryListProps {
  items: readonly SummaryListItem[];
  className?: string;
}

export function SummaryList({ items, className }: SummaryListProps) {
  return (
    <dl className={[styles["summary-list"], className].filter(Boolean).join(" ")}>
      {items.map((item) => (
        <div key={item.key} className={styles["summary-list__row"]}>
          <dt className={styles["summary-list__label"]}>{item.label}</dt>
          <dd className={styles["summary-list__value"]}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

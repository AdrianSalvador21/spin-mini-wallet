import type { ReactNode } from "react";
import { INPUT_TYPE } from "@/shared/ui/field/types";
import styles from "./segmented.module.scss";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedProps<T extends string> {
  label: string;
  name: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ label, name, options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={[styles.segmented, className].filter(Boolean).join(" ")}>
      {options.map((option) => {
        const checked = option.value === value;

        return (
          <label
            key={option.value}
            className={[styles.segmented__option, checked && styles["segmented__option--active"]]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              type={INPUT_TYPE.RADIO}
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className={styles.segmented__input}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

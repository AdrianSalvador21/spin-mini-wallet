import styles from "./progress-steps.module.scss";

interface ProgressStepsProps {
  current: number;
  total: number;
  label: string;
}

export function ProgressSteps({ current, total, label }: ProgressStepsProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
      className={styles["progress-steps"]}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={[styles["progress-steps__bar"], index < current && styles["progress-steps__bar--done"]]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </div>
  );
}

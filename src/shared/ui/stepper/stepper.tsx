import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import styles from "./stepper.module.scss";
import { STEP_STATE, type StepState } from "./types";

export interface StepperStep {
  label: ReactNode;
  state: StepState;
  href?: Route;
}

interface StepperProps {
  steps: readonly StepperStep[];
  label: string;
}

function StepContent({ step, index }: { step: StepperStep; index: number }) {
  return (
    <>
      <span className={styles.stepper__dot} aria-hidden="true">
        {step.state === STEP_STATE.DONE ? <Icon name={ICON_NAME.CHECK} size={ICON_SIZE.SM} /> : index + 1}
      </span>
      <span className={styles.stepper__label}>{step.label}</span>
    </>
  );
}

export function Stepper({ steps, label }: StepperProps) {
  return (
    <ol aria-label={label} className={styles.stepper}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const linked = step.state === STEP_STATE.DONE && step.href;

        return (
          <li
            key={index}
            aria-current={step.state === STEP_STATE.CURRENT ? "step" : undefined}
            className={[styles.stepper__item, styles[`stepper__item--${step.state}`]].join(" ")}
          >
            {linked ? (
              <Link href={linked} className={[styles.stepper__step, styles["stepper__step--link"]].join(" ")}>
                <StepContent step={step} index={index} />
              </Link>
            ) : (
              <span className={styles.stepper__step}>
                <StepContent step={step} index={index} />
              </span>
            )}
            {isLast ? null : (
              <span
                aria-hidden="true"
                className={[styles.stepper__line, step.state === STEP_STATE.DONE && styles["stepper__line--done"]]
                  .filter(Boolean)
                  .join(" ")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

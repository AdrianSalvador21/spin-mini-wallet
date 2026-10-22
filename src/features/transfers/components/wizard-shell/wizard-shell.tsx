"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { ROUTES } from "@/shared/lib/routes";
import { AppBar } from "@/shared/ui/app-bar/app-bar";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import { ProgressSteps } from "@/shared/ui/progress-steps/progress-steps";
import { Stepper, type StepperStep } from "@/shared/ui/stepper/stepper";
import { STEP_STATE, type StepState } from "@/shared/ui/stepper/types";
import { useTransferDraft } from "../../draft/draft-store";
import { previousStepRoute, stepFromPathname, TRANSFER_STEP_ROUTE } from "../../draft/step-guard";
import { TRANSFER_STEP, TRANSFER_STEP_ORDER } from "../../draft/types";
import { useDraftHydration } from "../../draft/use-draft-hydration";
import { useTransferBalance } from "../../hooks/use-transfer-balance";
import { LiveSummary } from "../live-summary/live-summary";
import styles from "./wizard-shell.module.scss";

function stepState(index: number, currentIndex: number): StepState {
  if (index < currentIndex) {
    return STEP_STATE.DONE;
  }

  return index === currentIndex ? STEP_STATE.CURRENT : STEP_STATE.UPCOMING;
}

interface WizardShellProps {
  children: ReactNode;
}

export function WizardShell({ children }: WizardShellProps) {
  const t = useTranslations("transfers");
  const pathname = usePathname();
  const step = stepFromPathname(pathname);
  const currentIndex = TRANSFER_STEP_ORDER.indexOf(step);
  const total = TRANSFER_STEP_ORDER.length;
  const title = t(`titles.${step}`);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const hydrated = useDraftHydration();
  const claim = useTransferDraft((draft) => draft.claim);
  const reset = useTransferDraft((draft) => draft.reset);
  const { summary } = useTransferBalance();
  const ownerId = summary.data?.user.id;

  useEffect(() => {
    if (hydrated && ownerId) {
      claim(ownerId);
    }
  }, [claim, hydrated, ownerId]);

  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      headingRef.current?.focus();
    }
  }, [step]);

  const stepperSteps: StepperStep[] = TRANSFER_STEP_ORDER.map((item, index) => ({
    label: t(`steps.${item}`),
    state: stepState(index, currentIndex),
    href: TRANSFER_STEP_ROUTE[item],
  }));

  return (
    <div className={styles["wizard-shell"]}>
      <div className={styles["wizard-shell__mobile-top"]}>
        <AppBar title={title} backHref={previousStepRoute(step)} step={{ current: currentIndex + 1, total }} />
        <div className={styles["wizard-shell__progress"]}>
          <ProgressSteps current={currentIndex + 1} total={total} label={t("steps.label")} />
        </div>
      </div>

      <div className={styles["wizard-shell__desktop-top"]}>
        <Link href={ROUTES.HOME} className={styles["wizard-shell__home"]}>
          <Icon name={ICON_NAME.BACK} size={ICON_SIZE.SM} />
          {t("actions.home")}
        </Link>
        <h1 className={styles["wizard-shell__h1"]}>{t("titles.desktop")}</h1>
        <div className={styles["wizard-shell__stepper"]}>
          <Stepper steps={stepperSteps} label={t("steps.label")} />
        </div>
      </div>

      <div
        className={[styles["wizard-shell__body"], step === TRANSFER_STEP.REVIEW && styles["wizard-shell__body--single"]]
          .filter(Boolean)
          .join(" ")}
      >
        <section aria-labelledby={headingId} className={styles["wizard-shell__card"]}>
          <div className={styles["wizard-shell__card-head"]}>
            <h2
              id={headingId}
              ref={headingRef}
              tabIndex={-1}
              className={[
                styles["wizard-shell__title"],
                step === TRANSFER_STEP.AMOUNT && styles["wizard-shell__title--hidden"],
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {title}
            </h2>
            <Link href={ROUTES.HOME} onClick={reset} className={styles["wizard-shell__cancel"]}>
              {t("actions.cancel")}
            </Link>
          </div>
          <div key={step} className={styles["wizard-shell__content"]}>
            {children}
          </div>
        </section>

        {step !== TRANSFER_STEP.REVIEW ? (
          <div className={styles["wizard-shell__aside"]}>
            <LiveSummary step={step} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

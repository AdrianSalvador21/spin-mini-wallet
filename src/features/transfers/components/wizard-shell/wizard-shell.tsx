"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useId, useRef, type ReactNode } from "react";
import { ROUTES } from "@/shared/lib/routes";
import { AppBar } from "@/shared/ui/app-bar/app-bar";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import { ProgressSteps } from "@/shared/ui/progress-steps/progress-steps";
import { Stepper, type StepperStep } from "@/shared/ui/stepper/stepper";
import { STEP_STATE, type StepState } from "@/shared/ui/stepper/types";
import { useTransferDraft } from "../../draft/draft-store";
import { previousStepRoute, stepFromPathname, TRANSFER_STEP_ROUTE } from "../../draft/step-guard";
import { TRANSFER_STEP, TRANSFER_STEP_ORDER, type TransferStep } from "../../draft/types";
import { useDraftHydration } from "../../draft/use-draft-hydration";
import { useNewRecipientMode } from "../../hooks/use-new-recipient-mode";
import { useTransferBalance } from "../../hooks/use-transfer-balance";
import { useSubmissionStore } from "../../submission/submission-store";
import { SUBMISSION_STATUS } from "../../submission/types";
import { LiveSummary } from "../live-summary/live-summary";
import styles from "./wizard-shell.module.scss";

function stepState(index: number, currentIndex: number): StepState {
  if (index < currentIndex) {
    return STEP_STATE.DONE;
  }

  return index === currentIndex ? STEP_STATE.CURRENT : STEP_STATE.UPCOMING;
}

const NEW_RECIPIENT_TITLE = "newRecipient";

type StepTitleKey = TransferStep | typeof NEW_RECIPIENT_TITLE;

function titleKeyFor(step: TransferStep, isNew: boolean): StepTitleKey {
  return step === TRANSFER_STEP.RECIPIENT && isNew ? NEW_RECIPIENT_TITLE : step;
}

function backRouteFor(step: TransferStep, isNew: boolean): Route {
  return step === TRANSFER_STEP.RECIPIENT && isNew ? ROUTES.TRANSFER_RECIPIENT : previousStepRoute(step);
}

function WithRecipientMode({ render }: { render: (isNew: boolean) => ReactNode }) {
  const { isNew } = useNewRecipientMode();

  return render(isNew);
}

function ModeAware({ render }: { render: (isNew: boolean) => ReactNode }) {
  return (
    <Suspense fallback={render(false)}>
      <WithRecipientMode render={render} />
    </Suspense>
  );
}

interface StepHeadingProps {
  id: string;
  titleKey: StepTitleKey;
  visuallyHidden: boolean;
}

function StepHeading({ id, titleKey, visuallyHidden }: StepHeadingProps) {
  const t = useTranslations("transfers.titles");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousKey = useRef(titleKey);

  useEffect(() => {
    if (previousKey.current !== titleKey) {
      previousKey.current = titleKey;
      headingRef.current?.focus();
    }
  }, [titleKey]);

  return (
    <h2
      id={id}
      ref={headingRef}
      tabIndex={-1}
      className={[styles["wizard-shell__title"], visuallyHidden && styles["wizard-shell__title--hidden"]]
        .filter(Boolean)
        .join(" ")}
    >
      {t(titleKey)}
    </h2>
  );
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
  const headingId = useId();
  const hydrated = useDraftHydration();
  const claim = useTransferDraft((draft) => draft.claim);
  const reset = useTransferDraft((draft) => draft.reset);
  const { summary } = useTransferBalance();
  const ownerId = summary.data?.user.id;
  const focused = useSubmissionStore((store) => store.state.status === SUBMISSION_STATUS.FAILED);

  useEffect(() => {
    if (hydrated && ownerId) {
      claim(ownerId);
    }
  }, [claim, hydrated, ownerId]);

  const stepperSteps: StepperStep[] = TRANSFER_STEP_ORDER.map((item, index) => ({
    label: t(`steps.${item}`),
    state: stepState(index, currentIndex),
    href: TRANSFER_STEP_ROUTE[item],
  }));

  return (
    <div className={styles["wizard-shell"]}>
      {focused ? null : (
        <div className={styles["wizard-shell__mobile-top"]}>
          <ModeAware
            render={(isNew) => (
              <AppBar
                title={t(`titles.${titleKeyFor(step, isNew)}`)}
                backHref={backRouteFor(step, isNew)}
                step={{ current: currentIndex + 1, total }}
              />
            )}
          />
          <div className={styles["wizard-shell__progress"]}>
            <ProgressSteps current={currentIndex + 1} total={total} label={t("steps.label")} />
          </div>
        </div>
      )}

      {focused ? null : (
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
      )}

      <div
        className={[
          styles["wizard-shell__body"],
          step === TRANSFER_STEP.REVIEW && styles["wizard-shell__body--single"],
          focused && styles["wizard-shell__body--focus"],
          focused && "mx-auto w-full max-w-focus",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <section
          aria-labelledby={focused ? undefined : headingId}
          className={[styles["wizard-shell__card"], focused && styles["wizard-shell__card--focus"]]
            .filter(Boolean)
            .join(" ")}
        >
          {focused ? null : (
            <div className={styles["wizard-shell__card-head"]}>
              <ModeAware
                render={(isNew) => (
                  <StepHeading
                    id={headingId}
                    titleKey={titleKeyFor(step, isNew)}
                    visuallyHidden={step === TRANSFER_STEP.AMOUNT}
                  />
                )}
              />
              <Link href={ROUTES.HOME} onClick={reset} className={styles["wizard-shell__cancel"]}>
                {t("actions.cancel")}
              </Link>
            </div>
          )}
          <div key={step} className={styles["wizard-shell__content"]}>
            {children}
          </div>
        </section>

        {step !== TRANSFER_STEP.REVIEW && !focused ? (
          <div className={styles["wizard-shell__aside"]}>
            <LiveSummary step={step} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

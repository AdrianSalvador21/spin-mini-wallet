"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { parseAmount, toMoney } from "@/domain/money/money";
import { useValidationMessage } from "@/shared/i18n/use-validation-message";
import { getRequestId } from "@/shared/lib/api/api-client";
import { amountInputFromCents, formatAmountInput } from "@/shared/lib/format/amount-input";
import { formatMoney, formatWholeMoney } from "@/shared/lib/format/money";
import { ROUTES } from "@/shared/lib/routes";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Chip } from "@/shared/ui/chip/chip";
import { Field } from "@/shared/ui/field/field";
import { AUTO_COMPLETE } from "@/shared/ui/field/types";
import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE } from "@/shared/ui/skeleton/types";
import { useTransferDraft } from "../../draft/draft-store";
import { useDraftPreview } from "../../draft/preview-store";
import { previousStepRoute } from "../../draft/step-guard";
import { TRANSFER_STEP } from "../../draft/types";
import { useStepGuard } from "../../draft/use-step-guard";
import { useTransferBalance } from "../../hooks/use-transfer-balance";
import {
  createAmountStepSchema,
  type AmountStepInput,
  type AmountStepOutput,
} from "../../schemas/amount-step-schema";
import { AmountInput } from "../amount-input/amount-input";
import { RetryAlert } from "../retry-alert/retry-alert";
import { WizardActions } from "../wizard-actions/wizard-actions";
import { WizardSkeleton } from "../wizard-skeleton/wizard-skeleton";
import styles from "./amount-step.module.scss";
import { AMOUNT_STEP_ERROR, CONCEPT_MAX_LENGTH, QUICK_AMOUNTS_IN_CENTS } from "./types";

export function AmountStep() {
  const ready = useStepGuard(TRANSFER_STEP.AMOUNT);

  return ready ? <AmountForm /> : <WizardSkeleton />;
}

function AmountForm() {
  const t = useTranslations("transfers");
  const router = useRouter();
  const validationMessage = useValidationMessage();
  const draftAmount = useTransferDraft((draft) => draft.amountInCents);
  const draftConcept = useTransferDraft((draft) => draft.concept);
  const setAmount = useTransferDraft((draft) => draft.setAmount);
  const previewAmount = useDraftPreview((preview) => preview.previewAmount);
  const { summary, balance } = useTransferBalance();
  const resolver = useMemo(() => zodResolver(createAmountStepSchema(balance)), [balance]);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<AmountStepInput, unknown, AmountStepOutput>({
    resolver,
    defaultValues: {
      amount: draftAmount === null ? "" : amountInputFromCents(draftAmount),
      concept: draftConcept,
    },
  });

  const amountValue = useWatch({ control, name: "amount" });
  const conceptValue = useWatch({ control, name: "concept" });

  useEffect(() => {
    const parsed = parseAmount(amountValue);
    previewAmount(parsed.ok ? parsed.value : null);
  }, [amountValue, previewAmount]);

  useEffect(() => () => previewAmount(undefined), [previewAmount]);

  function amountError(code: string | undefined) {
    if (code === AMOUNT_STEP_ERROR.BALANCE_REQUIRED) {
      return t("amount.balanceRequired");
    }

    if (code === AMOUNT_STEP_ERROR.INSUFFICIENT_FUNDS && balance) {
      return t("amount.insufficientFunds", { balance: formatMoney(balance) });
    }

    return validationMessage(code);
  }

  function balanceHint() {
    if (summary.isPending) {
      return <Skeleton shape={SKELETON_SHAPE.LINE} width="40%" />;
    }

    return balance ? t("amount.available", { amount: formatMoney(balance) }) : null;
  }

  function chooseAmount(value: string) {
    setValue("amount", value, { shouldDirty: true, shouldValidate: errors.amount !== undefined });
  }

  const onValid = (values: AmountStepOutput) => {
    if (!balance) {
      setError("amount", { type: AMOUNT_STEP_ERROR.BALANCE_REQUIRED, message: AMOUNT_STEP_ERROR.BALANCE_REQUIRED });
      return;
    }

    setAmount(values.amount, values.concept ?? "");
    router.push(ROUTES.TRANSFER_RECIPIENT);
  };

  const quickAmounts = QUICK_AMOUNTS_IN_CENTS.map((cents) => ({
    label: formatWholeMoney(toMoney(cents)),
    value: formatAmountInput(String(cents / 100)),
  }));
  const allValue = balance ? amountInputFromCents(balance.amountInCents) : null;

  return (
    <form className={styles["amount-step"]} noValidate onSubmit={handleSubmit(onValid)}>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <AmountInput
            ref={field.ref}
            id="transfer-amount"
            name={field.name}
            label={t("amount.label")}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={amountError(errors.amount?.message)}
            hint={balanceHint()}
          />
        )}
      />

      {summary.isError ? (
        <RetryAlert
          title={t("amount.balanceError")}
          retryLabel={t("amount.retry")}
          onRetry={() => void summary.refetch()}
          requestId={getRequestId(summary.error)}
        />
      ) : null}

      <div className={styles["amount-step__chips"]}>
        {quickAmounts.map((quick) => (
          <Chip key={quick.value} pressed={amountValue === quick.value} onClick={() => chooseAmount(quick.value)}>
            {quick.label}
          </Chip>
        ))}
        <Chip
          pressed={allValue !== null && amountValue === allValue}
          disabled={allValue === null}
          onClick={() => allValue && chooseAmount(allValue)}
        >
          {t("amount.all")}
        </Chip>
      </div>

      <Field
        {...register("concept")}
        id="transfer-concept"
        label={
          <>
            {t("amount.concept")} <span className={styles["amount-step__optional"]}>{t("amount.conceptOptional")}</span>
          </>
        }
        placeholder={t("amount.conceptPlaceholder")}
        maxLength={CONCEPT_MAX_LENGTH}
        autoComplete={AUTO_COMPLETE.OFF}
        hint={t("amount.conceptCounter", { count: conceptValue.length })}
        error={validationMessage(errors.concept?.message)}
      />

      <WizardActions backHref={previousStepRoute(TRANSFER_STEP.AMOUNT)}>
        <Button variant={BUTTON_VARIANT.PRIMARY} type={BUTTON_TYPE.SUBMIT}>
          {t("actions.continue")}
        </Button>
      </WizardActions>
    </form>
  );
}

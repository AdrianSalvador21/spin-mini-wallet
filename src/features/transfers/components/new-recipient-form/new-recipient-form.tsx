"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { detectBank } from "@/domain/contact/banks";
import { RECIPIENT_ACCOUNT_TYPE, type RecipientAccount } from "@/domain/contact/types";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { useValidationMessage } from "@/shared/i18n/use-validation-message";
import { API_FAILURE_KIND, getRequestId, type ApiFailureError } from "@/shared/lib/api/api-client";
import { formatPhoneInput, PHONE_COUNTRY_PREFIX } from "@/shared/lib/format/phone";
import { ROUTES } from "@/shared/lib/routes";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Checkbox } from "@/shared/ui/checkbox/checkbox";
import { Field } from "@/shared/ui/field/field";
import { AUTO_COMPLETE, INPUT_MODE, INPUT_TYPE } from "@/shared/ui/field/types";
import { Segmented, type SegmentedOption } from "@/shared/ui/segmented/segmented";
import { useCreateContact } from "../../api/use-create-contact";
import { useTransferDraft } from "../../draft/draft-store";
import { fieldForDetail, newRecipientResolver, toNewContactRequest } from "../../schemas/new-recipient-schema";
import { RetryAlert } from "../retry-alert/retry-alert";
import { WizardActions } from "../wizard-actions/wizard-actions";
import styles from "./new-recipient-form.module.scss";
import {
  BAD_REQUEST_STATUS,
  BANK_PREFIX_LENGTH,
  CARD_LENGTH,
  CLABE_LENGTH,
  NEW_RECIPIENT_FIELD,
  SERVER_ERROR_TYPE,
  type NewRecipientValues,
} from "./types";

function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function fieldDetails(error: ApiFailureError): Record<string, string[]> | null {
  if (error.failure.kind !== API_FAILURE_KIND.API || error.failure.status !== BAD_REQUEST_STATUS) {
    return null;
  }

  return error.failure.details ?? null;
}

export function NewRecipientForm() {
  const t = useTranslations("transfers");
  const tCommon = useTranslations("common.account");
  const router = useRouter();
  const validationMessage = useValidationMessage();
  const setRecipient = useTransferDraft((draft) => draft.setRecipient);
  const createContact = useCreateContact();
  const [failure, setFailure] = useState<ApiFailureError | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<NewRecipientValues>({
    resolver: newRecipientResolver,
    defaultValues: {
      type: RECIPIENT_ACCOUNT_TYPE.PHONE,
      name: "",
      phone: "",
      clabe: "",
      cardNumber: "",
      saveAsFavorite: true,
    },
  });

  const type = useWatch({ control, name: "type" });
  const clabe = useWatch({ control, name: NEW_RECIPIENT_FIELD.CLABE });
  const bank = clabe.length >= BANK_PREFIX_LENGTH ? detectBank(clabe) : null;

  const typeOptions: SegmentedOption<RecipientAccount["type"]>[] = [
    { value: RECIPIENT_ACCOUNT_TYPE.PHONE, label: tCommon("phone") },
    { value: RECIPIENT_ACCOUNT_TYPE.CLABE, label: tCommon("clabe") },
    { value: RECIPIENT_ACCOUNT_TYPE.CARD, label: tCommon("card") },
  ];

  const phoneField = register(NEW_RECIPIENT_FIELD.PHONE);
  const clabeField = register(NEW_RECIPIENT_FIELD.CLABE);
  const cardField = register(NEW_RECIPIENT_FIELD.CARD_NUMBER);

  const onValid = (values: NewRecipientValues) => {
    setFailure(null);

    createContact.mutate(toNewContactRequest(values), {
      onSuccess: (contact) => {
        setRecipient({ contactId: contact.id, name: contact.name, account: contact.account });
        router.push(ROUTES.TRANSFER_REVIEW);
      },
      onError: (error) => {
        const details = fieldDetails(error);

        if (details) {
          for (const [key, codes] of Object.entries(details)) {
            const field = fieldForDetail(key, values.type);

            if (field && codes[0]) {
              setError(field, { type: SERVER_ERROR_TYPE, message: codes[0] }, { shouldFocus: true });
            }
          }

          return;
        }

        setFailure(error);
      },
    });
  };

  const submit = handleSubmit(onValid);

  function accountField() {
    switch (type) {
      case RECIPIENT_ACCOUNT_TYPE.PHONE:
        return (
          <Field
            {...phoneField}
            key={type}
            id="new-recipient-phone"
            label={t("newRecipient.phone")}
            prefix={PHONE_COUNTRY_PREFIX}
            type={INPUT_TYPE.TEL}
            inputMode={INPUT_MODE.TEL}
            autoComplete={AUTO_COMPLETE.OFF}
            error={validationMessage(errors.phone?.message)}
            onChange={(event) => {
              event.target.value = formatPhoneInput(event.target.value);
              return phoneField.onChange(event);
            }}
          />
        );
      case RECIPIENT_ACCOUNT_TYPE.CLABE:
        return (
          <Field
            {...clabeField}
            key={type}
            id="new-recipient-clabe"
            label={t("newRecipient.clabe")}
            inputMode={INPUT_MODE.NUMERIC}
            autoComplete={AUTO_COMPLETE.OFF}
            maxLength={CLABE_LENGTH}
            hint={bank ? t("newRecipient.bank", { bank }) : undefined}
            error={validationMessage(errors.clabe?.message)}
            onChange={(event) => {
              event.target.value = digitsOnly(event.target.value, CLABE_LENGTH);
              return clabeField.onChange(event);
            }}
          />
        );
      case RECIPIENT_ACCOUNT_TYPE.CARD:
        return (
          <Field
            {...cardField}
            key={type}
            id="new-recipient-card"
            label={t("newRecipient.card")}
            inputMode={INPUT_MODE.NUMERIC}
            autoComplete={AUTO_COMPLETE.OFF}
            maxLength={CARD_LENGTH}
            error={validationMessage(errors.cardNumber?.message)}
            onChange={(event) => {
              event.target.value = digitsOnly(event.target.value, CARD_LENGTH);
              return cardField.onChange(event);
            }}
          />
        );
      default:
        return assertUnreachable(type);
    }
  }

  return (
    <form className={styles["new-recipient-form"]} noValidate onSubmit={submit}>
      {failure ? (
        <RetryAlert
          title={t("newRecipient.error")}
          retryLabel={t("newRecipient.retry")}
          onRetry={() => void submit()}
          requestId={getRequestId(failure)}
        />
      ) : null}

      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <div className={styles["new-recipient-form__type"]}>
            <Segmented
              label={t("newRecipient.type")}
              name={field.name}
              options={typeOptions}
              value={field.value}
              onChange={field.onChange}
            />
          </div>
        )}
      />

      <Field
        {...register(NEW_RECIPIENT_FIELD.NAME)}
        id="new-recipient-name"
        label={t("newRecipient.name")}
        autoComplete={AUTO_COMPLETE.OFF}
        error={validationMessage(errors.name?.message)}
      />

      {accountField()}

      <Controller
        control={control}
        name="saveAsFavorite"
        render={({ field }) => (
          <Checkbox
            ref={field.ref}
            id="new-recipient-favorite"
            name={field.name}
            label={t("newRecipient.favorite")}
            checked={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <WizardActions backHref={ROUTES.TRANSFER_RECIPIENT}>
        <Button variant={BUTTON_VARIANT.PRIMARY} type={BUTTON_TYPE.SUBMIT} loading={createContact.isPending}>
          {t("actions.continue")}
        </Button>
      </WizardActions>
    </form>
  );
}

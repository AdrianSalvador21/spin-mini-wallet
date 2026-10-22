"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { registerSchema } from "@/domain/user/schemas";
import { useValidationMessage } from "@/shared/i18n/use-validation-message";
import {
  AUTH_FAILURE_KIND,
  AUTH_FORM_STATUS,
  type AuthFormState,
  type RegisterFormValues,
} from "@/shared/lib/auth/form-state";
import { formatPhoneInput, PHONE_COUNTRY_PREFIX } from "@/shared/lib/format/phone";
import { ActionBar } from "@/shared/ui/action-bar/action-bar";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Field } from "@/shared/ui/field/field";
import { AUTO_COMPLETE, INPUT_MODE, INPUT_TYPE } from "@/shared/ui/field/types";
import { PasswordInput } from "@/shared/ui/password-input/password-input";
import { registerAction } from "../../actions";
import { AuthFailureAlert } from "../auth-failure-alert/auth-failure-alert";

const INITIAL_STATE: AuthFormState = { status: AUTH_FORM_STATUS.IDLE };
const SERVER_ERROR_TYPE = "server";
const REGISTER_FIELD_NAMES: readonly (keyof RegisterFormValues)[] = [
  "fullName",
  "phone",
  "email",
  "password",
  "passwordConfirmation",
];

const resolver = zodResolver(registerSchema, undefined, { raw: true });

function isRegisterField(name: string): name is keyof RegisterFormValues {
  return (REGISTER_FIELD_NAMES as readonly string[]).includes(name);
}

export function RegisterForm() {
  const t = useTranslations("auth.register");
  const validationMessage = useValidationMessage();
  const [state, formAction, pending] = useActionState(registerAction, INITIAL_STATE);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver,
    defaultValues: { fullName: "", phone: "", email: "", password: "", passwordConfirmation: "" },
  });

  const phoneField = register("phone");

  useEffect(() => {
    if (state.status !== AUTH_FORM_STATUS.ERROR || state.failure.kind !== AUTH_FAILURE_KIND.VALIDATION) {
      return;
    }

    for (const [name, codes] of Object.entries(state.failure.fieldErrors)) {
      if (isRegisterField(name) && codes[0]) {
        setError(name, { type: SERVER_ERROR_TYPE, message: codes[0] });
      }
    }
  }, [state, setError]);

  const onValid = (values: RegisterFormValues) => {
    startTransition(() => formAction(values));
  };

  return (
    <form className="flex flex-1 flex-col gap-4" noValidate onSubmit={handleSubmit(onValid)}>
      {state.status === AUTH_FORM_STATUS.ERROR && <AuthFailureAlert failure={state.failure} />}
      <Field
        {...register("fullName")}
        id="register-full-name"
        label={t("fullNameLabel")}
        autoComplete={AUTO_COMPLETE.NAME}
        error={validationMessage(errors.fullName?.message)}
      />
      <Field
        {...phoneField}
        id="register-phone"
        label={t("phoneLabel")}
        prefix={PHONE_COUNTRY_PREFIX}
        type={INPUT_TYPE.TEL}
        inputMode={INPUT_MODE.TEL}
        autoComplete={AUTO_COMPLETE.TEL_NATIONAL}
        error={validationMessage(errors.phone?.message)}
        onChange={(event) => {
          event.target.value = formatPhoneInput(event.target.value);
          return phoneField.onChange(event);
        }}
      />
      <Field
        {...register("email")}
        id="register-email"
        label={t("emailLabel")}
        type={INPUT_TYPE.EMAIL}
        inputMode={INPUT_MODE.EMAIL}
        autoComplete={AUTO_COMPLETE.EMAIL}
        error={validationMessage(errors.email?.message)}
      />
      <PasswordInput
        {...register("password")}
        id="register-password"
        label={t("passwordLabel")}
        hint={t("passwordHint")}
        autoComplete={AUTO_COMPLETE.NEW_PASSWORD}
        error={validationMessage(errors.password?.message)}
      />
      <PasswordInput
        {...register("passwordConfirmation")}
        id="register-password-confirmation"
        label={t("passwordConfirmationLabel")}
        autoComplete={AUTO_COMPLETE.NEW_PASSWORD}
        error={validationMessage(errors.passwordConfirmation?.message)}
      />
      <ActionBar>
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          type={BUTTON_TYPE.SUBMIT}
          block
          loading={pending}
          loadingLabel={t("submitting")}
        >
          {t("submit")}
        </Button>
      </ActionBar>
    </form>
  );
}

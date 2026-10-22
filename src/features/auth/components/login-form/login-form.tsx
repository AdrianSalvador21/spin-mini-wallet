"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { LOGIN_METHOD, loginSchema } from "@/domain/user/schemas";
import { useValidationMessage } from "@/shared/i18n/use-validation-message";
import { AUTH_FAILURE_KIND, AUTH_FORM_STATUS, type AuthFormState } from "@/shared/lib/auth/form-state";
import { formatPhoneInput, PHONE_COUNTRY_PREFIX } from "@/shared/lib/format/phone";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "@/shared/ui/button/types";
import { Field } from "@/shared/ui/field/field";
import { AUTO_COMPLETE, INPUT_MODE, INPUT_TYPE } from "@/shared/ui/field/types";
import { PasswordInput } from "@/shared/ui/password-input/password-input";
import { loginAction } from "../../actions";
import { toLoginInput, type LoginFields } from "../../login-values";
import { AuthFailureAlert } from "../auth-failure-alert/auth-failure-alert";
import styles from "./login-form.module.scss";

const INITIAL_STATE: AuthFormState = { status: AUTH_FORM_STATUS.IDLE };
const SERVER_ERROR_TYPE = "server";
const LOGIN_FIELD_NAMES: readonly (keyof LoginFields)[] = ["phone", "email", "password"];

const resolver = zodResolver(loginSchema, undefined, { raw: true }) as unknown as Resolver<LoginFields>;

function isLoginField(name: string): name is keyof LoginFields {
  return (LOGIN_FIELD_NAMES as readonly string[]).includes(name);
}

export function LoginForm() {
  const t = useTranslations("auth.login");
  const validationMessage = useValidationMessage();
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE);
  const [dismissedState, setDismissedState] = useState<AuthFormState | null>(null);
  const switchedMethod = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver,
    defaultValues: { method: LOGIN_METHOD.PHONE, phone: "", email: "", password: "" },
  });

  const method = useWatch({ control, name: "method" });
  const phoneField = register("phone");

  useEffect(() => {
    if (state.status !== AUTH_FORM_STATUS.ERROR || state.failure.kind !== AUTH_FAILURE_KIND.VALIDATION) {
      return;
    }

    for (const [name, codes] of Object.entries(state.failure.fieldErrors)) {
      if (isLoginField(name) && codes[0]) {
        setError(name, { type: SERVER_ERROR_TYPE, message: codes[0] });
      }
    }
  }, [state, setError]);

  useEffect(() => {
    if (switchedMethod.current) {
      setFocus(method);
    }
  }, [method, setFocus]);

  const switchMethod = () => {
    const nextMethod = method === LOGIN_METHOD.PHONE ? LOGIN_METHOD.EMAIL : LOGIN_METHOD.PHONE;

    switchedMethod.current = true;
    setDismissedState(state);
    reset({ method: nextMethod, phone: "", email: "", password: getValues("password") });
  };

  const onValid = (fields: LoginFields) => {
    startTransition(() => formAction(toLoginInput(fields)));
  };

  const failure = state.status === AUTH_FORM_STATUS.ERROR && state !== dismissedState ? state.failure : null;

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onValid)}>
      {failure && <AuthFailureAlert failure={failure} />}
      {method === LOGIN_METHOD.PHONE ? (
        <Field
          {...phoneField}
          id="login-phone"
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
      ) : (
        <Field
          {...register("email")}
          id="login-email"
          label={t("emailLabel")}
          type={INPUT_TYPE.EMAIL}
          inputMode={INPUT_MODE.EMAIL}
          autoComplete={AUTO_COMPLETE.EMAIL}
          error={validationMessage(errors.email?.message)}
        />
      )}
      <PasswordInput
        {...register("password")}
        id="login-password"
        label={t("passwordLabel")}
        autoComplete={AUTO_COMPLETE.CURRENT_PASSWORD}
        error={validationMessage(errors.password?.message)}
      />
      <Button
        variant={BUTTON_VARIANT.PRIMARY}
        type={BUTTON_TYPE.SUBMIT}
        block
        loading={pending}
        loadingLabel={t("submitting")}
      >
        {t("submit")}
      </Button>
      <button type={BUTTON_TYPE.BUTTON} className={styles["login-form__switch"]} onClick={switchMethod}>
        {method === LOGIN_METHOD.PHONE ? t("switchToEmail") : t("switchToPhone")}
      </button>
    </form>
  );
}

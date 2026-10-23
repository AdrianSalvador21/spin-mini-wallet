"use client";

import { useTranslations } from "next-intl";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { AUTH_FAILURE_KIND, type AuthFailure } from "@/shared/lib/auth/form-state";
import { Alert } from "@/shared/ui/alert/alert";
import { ALERT_ROLE, ALERT_TONE } from "@/shared/ui/alert/types";
import { SupportReference } from "@/shared/ui/support-reference/support-reference";

interface AuthFailureAlertProps {
  failure: AuthFailure;
}

export function AuthFailureAlert({ failure }: AuthFailureAlertProps) {
  const t = useTranslations("auth.failure");

  switch (failure.kind) {
    case AUTH_FAILURE_KIND.VALIDATION:
      return null;
    case AUTH_FAILURE_KIND.INVALID_CREDENTIALS:
      return (
        <Alert tone={ALERT_TONE.DANGER} role={ALERT_ROLE.ALERT}>
          {t(`invalidCredentials.${failure.method}`)}
        </Alert>
      );
    case AUTH_FAILURE_KIND.RATE_LIMITED:
      return (
        <Alert tone={ALERT_TONE.DANGER} role={ALERT_ROLE.ALERT}>
          {t("rateLimited", { minutes: failure.retryAfterMinutes })}
        </Alert>
      );
    case AUTH_FAILURE_KIND.UNEXPECTED:
      return (
        <Alert tone={ALERT_TONE.DANGER} role={ALERT_ROLE.ALERT}>
          <p>{t("unexpected")}</p>
          <SupportReference requestId={failure.requestId} />
        </Alert>
      );
    default:
      return assertUnreachable(failure);
  }
}

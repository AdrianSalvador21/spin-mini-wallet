"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "@/shared/ui/button/types";
import { logoutAction } from "../../actions";

function LogoutSubmit() {
  const t = useTranslations("auth.logout");
  const { pending } = useFormStatus();

  return (
    <Button variant={BUTTON_VARIANT.SECONDARY} type={BUTTON_TYPE.SUBMIT} loading={pending} loadingLabel={t("submitting")}>
      {t("submit")}
    </Button>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <LogoutSubmit />
    </form>
  );
}

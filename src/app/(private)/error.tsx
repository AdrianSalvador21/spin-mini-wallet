"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect } from "react";
import { ERROR_SOURCE, getErrorReporter } from "@/shared/observability/error-reporter";
import { ROUTES } from "@/shared/lib/routes";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";

interface PrivateErrorProps {
  error: unknown;
  retry: () => void;
}

export default function PrivateError({ error, retry }: PrivateErrorProps) {
  const t = useTranslations("common.errorPage");

  useEffect(() => {
    const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

    getErrorReporter().captureException(error, { source: ERROR_SOURCE.BROWSER, digest });
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1>{t("title")}</h1>
      <p>{t("text")}</p>
      <Button variant={BUTTON_VARIANT.PRIMARY} onClick={() => retry()}>
        {t("retry")}
      </Button>
      <Link href={ROUTES.HOME}>{t("home")}</Link>
    </div>
  );
}

"use client";

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useEffect } from "react";
import commonMessages from "@/messages/es-MX/common.json";
import { locale, timeZone } from "@/shared/i18n/config";
import { ERROR_SOURCE, getErrorReporter } from "@/shared/observability/error-reporter";
import { montserrat, openSans } from "@/shared/styles/fonts";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import "./globals.css";

interface GlobalErrorProps {
  error: unknown;
  retry: () => void;
}

function GlobalErrorContent({ error, retry }: GlobalErrorProps) {
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
      <a href="/home">{t("home")}</a>
    </div>
  );
}

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  return (
    <html lang={locale} className={`${montserrat.variable} ${openSans.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={{ common: commonMessages.common }}>
          <GlobalErrorContent error={error} retry={retry} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

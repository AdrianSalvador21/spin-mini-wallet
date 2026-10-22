"use client";

import { catchError, type ErrorInfo } from "next/error";
import { useEffect } from "react";
import { ERROR_SOURCE, getErrorReporter } from "@/shared/observability/error-reporter";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import styles from "./block-error-boundary.module.scss";

interface BlockErrorBoundaryProps {
  title: string;
  retryLabel: string;
}

function BlockErrorBoundaryFallback({ title, retryLabel }: BlockErrorBoundaryProps, { error, retry }: ErrorInfo) {
  useEffect(() => {
    getErrorReporter().captureException(error, { source: ERROR_SOURCE.BROWSER });
  }, [error]);

  return (
    <div className={styles["block-error-boundary"]} role="alert">
      <p className={styles["block-error-boundary__title"]}>{title}</p>
      <Button variant={BUTTON_VARIANT.SECONDARY} onClick={() => retry()}>
        {retryLabel}
      </Button>
    </div>
  );
}

export const BlockErrorBoundary = catchError(BlockErrorBoundaryFallback);

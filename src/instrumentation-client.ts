import { ERROR_SOURCE, getErrorReporter } from "@/shared/observability/error-reporter";

window.addEventListener("error", (event) => {
  getErrorReporter().captureException(event.error ?? event.message, {
    source: ERROR_SOURCE.BROWSER,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  getErrorReporter().captureException(event.reason, {
    source: ERROR_SOURCE.BROWSER,
  });
});

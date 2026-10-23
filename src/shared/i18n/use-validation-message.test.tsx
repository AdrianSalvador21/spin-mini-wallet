import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/es-MX";
import { locale, timeZone } from "./config";
import { useValidationMessage } from "./use-validation-message";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("useValidationMessage", () => {
  it("translates a validation code", () => {
    const { result } = renderHook(() => useValidationMessage(), { wrapper });

    expect(result.current("PHONE_REQUIRED")).toBe("Escribe tu número celular.");
  });

  it("returns undefined for a missing or unknown code", () => {
    const { result } = renderHook(() => useValidationMessage(), { wrapper });

    expect(result.current(undefined)).toBeUndefined();
    expect(result.current("NOT_A_CODE")).toBeUndefined();
  });
});

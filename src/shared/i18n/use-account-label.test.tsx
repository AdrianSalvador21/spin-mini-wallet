import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import messages from "@/messages/es-MX";
import type { AccountView } from "@/shared/lib/api/views";
import { locale, timeZone } from "./config";
import { useAccountLabel } from "./use-account-label";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("useAccountLabel", () => {
  it.each([
    [RECIPIENT_ACCOUNT_TYPE.PHONE, "Celular •••• 6789"],
    [RECIPIENT_ACCOUNT_TYPE.CLABE, "CLABE •••• 6789"],
    [RECIPIENT_ACCOUNT_TYPE.CARD, "Tarjeta •••• 6789"],
  ])("labels a %s account", (type, expected) => {
    const { result } = renderHook(() => useAccountLabel(), { wrapper });

    expect(result.current({ type, masked: "•••• 6789" })).toBe(expected);
  });

  it("throws for an account type outside the union", () => {
    const { result } = renderHook(() => useAccountLabel(), { wrapper });
    const invalid = { type: "iban", masked: "•••• 6789" } as unknown as AccountView;

    expect(() => result.current(invalid)).toThrow();
  });
});

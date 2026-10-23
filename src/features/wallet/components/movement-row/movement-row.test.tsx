import { createTranslator } from "use-intl/core";
import { describe, expect, it } from "vitest";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import type { RecipientAccount } from "@/domain/contact/types";
import type { MovementType } from "@/domain/wallet/types";
import messages from "@/messages/es-MX";
import type { MovementView } from "@/shared/lib/api/views";
import { renderWithProviders, screen } from "@/test/render";
import {
  getAccountTypeLabel,
  getMovementDetail,
  getMovementIcon,
  getMovementTitle,
  MovementRow,
} from "./movement-row";

const t = createTranslator({ locale: "es-MX", messages, namespace: "home.movements" });
const tCommon = createTranslator({ locale: "es-MX", messages, namespace: "common" });
const NOW = "2026-10-22T18:00:00.000Z";

function buildMovement(overrides: Partial<MovementView> = {}): MovementView {
  return {
    id: "mov_1" as MovementView["id"],
    type: "cash_deposit",
    direction: "credit",
    amount: toMoney(10_000 as Cents),
    createdAt: NOW,
    ...overrides,
  };
}

describe("getMovementTitle", () => {
  it("uses the counterparty name for transfer_out", () => {
    expect(getMovementTitle(t, { type: "transfer_out", counterpartyName: "Carlos Ruiz" })).toBe(
      "Envío a Carlos Ruiz",
    );
  });

  it("falls back for transfer_out without a name", () => {
    expect(getMovementTitle(t, { type: "transfer_out" })).toBe("Envío de dinero");
  });

  it("uses the counterparty name for transfer_in", () => {
    expect(getMovementTitle(t, { type: "transfer_in", counterpartyName: "Diego Ramírez" })).toBe(
      "Recibido de Diego Ramírez",
    );
  });

  it("falls back for transfer_in without a name", () => {
    expect(getMovementTitle(t, { type: "transfer_in" })).toBe("Dinero recibido");
  });

  it("uses the merchant name for cash_deposit", () => {
    expect(getMovementTitle(t, { type: "cash_deposit", merchantName: "OXXO Insurgentes" })).toBe(
      "Depósito en OXXO Insurgentes",
    );
  });

  it("falls back for cash_deposit without a merchant", () => {
    expect(getMovementTitle(t, { type: "cash_deposit" })).toBe("Depósito en efectivo");
  });

  it("uses the merchant name for qr_payment", () => {
    expect(getMovementTitle(t, { type: "qr_payment", merchantName: "OXXO Reforma" })).toBe(
      "Pago con QR · OXXO Reforma",
    );
  });

  it("falls back for qr_payment without a merchant", () => {
    expect(getMovementTitle(t, { type: "qr_payment" })).toBe("Pago con QR");
  });

  it("throws for a type outside the union", () => {
    const invalid = "unknown" as unknown as MovementType;
    expect(() => getMovementTitle(t, { type: invalid })).toThrow();
  });
});

describe("getAccountTypeLabel", () => {
  it.each([
    ["phone", "Celular"],
    ["clabe", "CLABE"],
    ["card", "Tarjeta"],
  ])("labels %s as %s", (type, expected) => {
    expect(getAccountTypeLabel(tCommon, type as RecipientAccount["type"])).toBe(expected);
  });

  it("throws for an account type outside the union", () => {
    const invalid = "unknown" as unknown as RecipientAccount["type"];
    expect(() => getAccountTypeLabel(tCommon, invalid)).toThrow();
  });
});

describe("getMovementDetail", () => {
  it("shows the masked account for transfer_out", () => {
    const detail = getMovementDetail(t, tCommon, {
      type: "transfer_out",
      counterpartyAccount: { type: "phone", masked: "•••• 5678" },
    });
    expect(detail).toBe("Celular •••• 5678");
  });

  it("is undefined for transfer_out without an account", () => {
    expect(getMovementDetail(t, tCommon, { type: "transfer_out" })).toBeUndefined();
  });

  it("shows cash for cash_deposit", () => {
    expect(getMovementDetail(t, tCommon, { type: "cash_deposit" })).toBe("Efectivo");
  });

  it("shows store for qr_payment", () => {
    expect(getMovementDetail(t, tCommon, { type: "qr_payment" })).toBe("Compra en tienda");
  });

  it("throws for a type outside the union", () => {
    const invalid = "unknown" as unknown as MovementType;
    expect(() => getMovementDetail(t, tCommon, { type: invalid })).toThrow();
  });
});

describe("getMovementIcon", () => {
  it.each([
    ["transfer_out", "send"],
    ["transfer_in", "arrow-in"],
    ["cash_deposit", "arrow-in"],
    ["qr_payment", "store"],
  ])("maps %s to the %s icon", (type, icon) => {
    expect(getMovementIcon(type as MovementType)).toBe(icon);
  });

  it("throws for a type outside the union", () => {
    const invalid = "unknown" as unknown as MovementType;
    expect(() => getMovementIcon(invalid)).toThrow();
  });
});

describe("MovementRow", () => {
  it("renders a credit with a + sign and the success class", () => {
    renderWithProviders(
      <ul>
        <MovementRow movement={buildMovement({ direction: "credit", amount: toMoney(10_000 as Cents) })} now={NOW} />
      </ul>,
    );

    expect(screen.getByText("+$100.00")).toBeInTheDocument();
    expect(screen.getByText("+$100.00").className).toContain("movement-row__amount--credit");
  });

  it("renders a debit with a − sign and the ink class", () => {
    renderWithProviders(
      <ul>
        <MovementRow
          movement={buildMovement({
            type: "transfer_out",
            direction: "debit",
            amount: toMoney(3_500 as Cents),
            counterpartyName: "Carlos Ruiz",
          })}
          now={NOW}
        />
      </ul>,
    );

    expect(screen.getByText("−$35.00")).toBeInTheDocument();
    expect(screen.getByText("−$35.00").className).toContain("movement-row__amount--debit");
  });

  it("links a sent transfer with a transferId to its receipt, named by the row's text", () => {
    renderWithProviders(
      <ul>
        <MovementRow
          movement={buildMovement({
            type: "transfer_out",
            direction: "debit",
            amount: toMoney(3_500 as Cents),
            counterpartyName: "Carlos Ruiz",
            transferId: "trf_42" as MovementView["transferId"],
          })}
          now={NOW}
        />
      </ul>,
    );

    const link = screen.getByRole("link");

    expect(link).toHaveAttribute("href", "/transfers/trf_42");
    expect(link).toHaveAccessibleName(expect.stringContaining("Envío a Carlos Ruiz"));
    expect(link.closest("li")).toBeInTheDocument();
  });

  it.each<[string, Partial<MovementView>]>([
    ["a received transfer", { type: "transfer_in", direction: "credit", transferId: "trf_in" as MovementView["transferId"] }],
    ["a cash deposit", { type: "cash_deposit", direction: "credit" }],
    ["a QR payment", { type: "qr_payment", direction: "debit", merchantName: "OXXO" }],
    ["a sent transfer without a transferId", { type: "transfer_out", direction: "debit" }],
  ])("does not link %s", (_label, overrides) => {
    renderWithProviders(
      <ul>
        <MovementRow movement={buildMovement(overrides)} now={NOW} />
      </ul>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });
});

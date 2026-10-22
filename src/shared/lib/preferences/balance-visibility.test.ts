import { afterEach, describe, expect, it } from "vitest";
import { isBalanceHidden, writeBalanceHidden } from "./balance-visibility";

afterEach(() => {
  document.cookie = "smw_balance_hidden=; Path=/; Max-Age=0";
});

describe("isBalanceHidden", () => {
  it("is hidden when the cookie value is 1", () => {
    expect(isBalanceHidden("1")).toBe(true);
  });

  it("is visible when the cookie is absent", () => {
    expect(isBalanceHidden(undefined)).toBe(false);
  });

  it("is visible for any other value", () => {
    expect(isBalanceHidden("0")).toBe(false);
  });
});

describe("writeBalanceHidden", () => {
  it("writes the cookie when hiding the balance", () => {
    writeBalanceHidden(true);

    expect(document.cookie).toContain("smw_balance_hidden=1");
  });

  it("clears the cookie when showing the balance", () => {
    writeBalanceHidden(true);
    writeBalanceHidden(false);

    expect(document.cookie).not.toContain("smw_balance_hidden=1");
  });
});

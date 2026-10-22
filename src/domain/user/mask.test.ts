import { describe, expect, it } from "vitest";
import { maskPhone } from "./mask";

describe("maskPhone", () => {
  it("masks a 10-digit phone", () => {
    expect(maskPhone("5512345678")).toBe("55 •••• 5678");
  });

  it("strips spaces before masking", () => {
    expect(maskPhone("55 1234 5678")).toBe("55 •••• 5678");
  });
});

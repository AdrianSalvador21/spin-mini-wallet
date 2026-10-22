import { describe, expect, it } from "vitest";
import { detectBank } from "./banks";

describe("detectBank", () => {
  it("detects a known bank from the CLABE prefix", () => {
    expect(detectBank("002123456789012343")).toBe("Banamex");
  });

  it("detects another known bank from the CLABE prefix", () => {
    expect(detectBank("072123456789012340")).toBe("Banorte");
  });

  it("returns null for a CLABE whose bank code is outside the catalog", () => {
    expect(detectBank("999123456789012346")).toBeNull();
  });
});

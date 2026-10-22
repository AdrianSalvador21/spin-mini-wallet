import { describe, expect, it } from "vitest";
import { getFirstName, getInitials } from "./name";

describe("getFirstName", () => {
  it("returns the first word", () => {
    expect(getFirstName("Mariana López")).toBe("Mariana");
  });

  it("trims surrounding whitespace", () => {
    expect(getFirstName("  Diego Ramírez  ")).toBe("Diego");
  });
});

describe("getInitials", () => {
  it("returns a single initial for one name", () => {
    expect(getInitials("Mariana")).toBe("M");
  });

  it("returns first and last initials for two names", () => {
    expect(getInitials("Mariana López")).toBe("ML");
  });

  it("returns first and last initials for three names", () => {
    expect(getInitials("Mariana López García")).toBe("MG");
  });

  it("returns an empty string for an empty name", () => {
    expect(getInitials("   ")).toBe("");
  });
});

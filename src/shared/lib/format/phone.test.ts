import { describe, expect, it } from "vitest";
import { formatPhoneInput } from "./phone";

describe("formatPhoneInput", () => {
  it.each([
    ["", ""],
    ["abc", ""],
    ["55a1b2", "55 12"],
    ["5", "5"],
    ["55", "55"],
    ["551", "55 1"],
    ["551234", "55 1234"],
    ["5512345", "55 1234 5"],
    ["5512345678", "55 1234 5678"],
    ["551234567899", "55 1234 5678"],
    ["55 1234 5678", "55 1234 5678"],
  ])("formats %j as %j", (raw, expected) => {
    expect(formatPhoneInput(raw)).toBe(expected);
  });
});

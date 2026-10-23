import { afterEach, describe, expect, it } from "vitest";
import { readScenarioCookies, writeScenarioCookie } from "./scenario-cookies";

function clearCookies() {
  writeScenarioCookie("mock_scenario", null);
  writeScenarioCookie("mock_read_scenario", null);
}

afterEach(clearCookies);

describe("readScenarioCookies", () => {
  it("reads both scenarios from a cookie string", () => {
    expect(readScenarioCookies("a=1; mock_scenario=timeout; mock_read_scenario=movements_error")).toEqual({
      transfer: "timeout",
      read: "movements_error",
    });
  });

  it("returns null for a missing or unknown value", () => {
    expect(readScenarioCookies("mock_scenario=teleport")).toEqual({
      transfer: null,
      read: null,
    });
    expect(readScenarioCookies("")).toEqual({ transfer: null, read: null });
  });

  it("does not confuse mock_scenario with mock_read_scenario", () => {
    expect(readScenarioCookies("mock_read_scenario=error")).toEqual({
      transfer: null,
      read: "error",
    });
  });

  it("reads document.cookie by default", () => {
    document.cookie = "mock_scenario=success; Path=/";

    expect(readScenarioCookies().transfer).toBe("success");
  });
});

describe("writeScenarioCookie", () => {
  it("writes a scenario and clears it with null", () => {
    writeScenarioCookie("mock_scenario", "network_error");

    expect(document.cookie).toContain("mock_scenario=network_error");

    writeScenarioCookie("mock_scenario", null);

    expect(document.cookie).not.toContain("mock_scenario=");
  });
});

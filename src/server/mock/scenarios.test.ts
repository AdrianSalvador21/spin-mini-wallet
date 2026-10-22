import "server-only";
import { describe, expect, it } from "vitest";
import { READ_SCENARIO, TRANSFER_SCENARIO } from "@/shared/lib/api/contract";
import {
  READ_LATENCY_MS,
  TRANSFER_LATENCY_MS,
  latencyMs,
  pickScenario,
  resolveReadScenario,
  resolveTransferScenario,
} from "./scenarios";

function fixedRandom(value: number): () => number {
  return () => value;
}

describe("pickScenario", () => {
  it.each([
    [0, TRANSFER_SCENARIO.SUCCESS],
    [0.5999, TRANSFER_SCENARIO.SUCCESS],
    [0.6, TRANSFER_SCENARIO.NETWORK_ERROR],
    [0.7, TRANSFER_SCENARIO.INSUFFICIENT_FUNDS],
    [0.8, TRANSFER_SCENARIO.TIMEOUT],
    [0.9, TRANSFER_SCENARIO.UNKNOWN_ERROR],
    [0.9999, TRANSFER_SCENARIO.UNKNOWN_ERROR],
  ])("returns %s for random %s", (value, expected) => {
    expect(pickScenario(fixedRandom(value))).toBe(expected);
  });
});

describe("resolveTransferScenario", () => {
  it("returns the cookie value when override is allowed and the value is valid", () => {
    expect(resolveTransferScenario("timeout", true, fixedRandom(0))).toBe(TRANSFER_SCENARIO.TIMEOUT);
  });

  it("falls back to pickScenario when override is not allowed", () => {
    expect(resolveTransferScenario("timeout", false, fixedRandom(0))).toBe(TRANSFER_SCENARIO.SUCCESS);
  });

  it("falls back to pickScenario when the cookie is missing", () => {
    expect(resolveTransferScenario(undefined, true, fixedRandom(0))).toBe(TRANSFER_SCENARIO.SUCCESS);
  });

  it("falls back to pickScenario when the cookie value is unknown", () => {
    expect(resolveTransferScenario("typo", true, fixedRandom(0))).toBe(TRANSFER_SCENARIO.SUCCESS);
  });
});

describe("resolveReadScenario", () => {
  it("returns the cookie value when override is allowed and the value is valid", () => {
    expect(resolveReadScenario("error", true)).toBe(READ_SCENARIO.ERROR);
  });

  it("falls back to ok when override is not allowed", () => {
    expect(resolveReadScenario("error", false)).toBe(READ_SCENARIO.OK);
  });

  it("falls back to ok when the cookie is missing", () => {
    expect(resolveReadScenario(undefined, true)).toBe(READ_SCENARIO.OK);
  });

  it("falls back to ok when the cookie value is unknown", () => {
    expect(resolveReadScenario("typo", true)).toBe(READ_SCENARIO.OK);
  });
});

describe("latencyMs", () => {
  it("stays inside the range at random 0", () => {
    expect(latencyMs(READ_LATENCY_MS, fixedRandom(0))).toBe(READ_LATENCY_MS[0]);
    expect(latencyMs(TRANSFER_LATENCY_MS, fixedRandom(0))).toBe(TRANSFER_LATENCY_MS[0]);
  });

  it("stays inside the range at random 0.9999", () => {
    expect(latencyMs(READ_LATENCY_MS, fixedRandom(0.9999))).toBe(READ_LATENCY_MS[1]);
    expect(latencyMs(TRANSFER_LATENCY_MS, fixedRandom(0.9999))).toBe(TRANSFER_LATENCY_MS[1]);
  });
});

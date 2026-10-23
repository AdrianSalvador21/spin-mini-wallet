import "server-only";
import { describe, expect, it, vi } from "vitest";
import { READ_OUTCOME, type ReadOutcome } from "@/shared/lib/api/contract";
import { READ_LATENCY_MS, SLOW_READ_MS } from "./scenarios";
import { runReadScenario } from "./read-scenario";

function buildDeps(sleepCalls: number[]) {
  return {
    sleep: async (ms: number) => {
      sleepCalls.push(ms);
    },
    random: () => 0,
  };
}

describe("runReadScenario", () => {
  it("waits inside the read latency range and calls onOk for ok", async () => {
    const sleepCalls: number[] = [];
    const onOk = vi.fn(async () => "ok-value");
    const onError = vi.fn(async () => "error-value");

    const result = await runReadScenario(READ_OUTCOME.OK, buildDeps(sleepCalls), onOk, onError);

    expect(result).toBe("ok-value");
    expect(sleepCalls).toEqual([READ_LATENCY_MS[0]]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("waits the slow duration and calls onOk for slow", async () => {
    const sleepCalls: number[] = [];
    const onOk = vi.fn(async () => "ok-value");
    const onError = vi.fn(async () => "error-value");

    const result = await runReadScenario(READ_OUTCOME.SLOW, buildDeps(sleepCalls), onOk, onError);

    expect(result).toBe("ok-value");
    expect(sleepCalls).toEqual([SLOW_READ_MS]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("waits inside the read latency range and calls onError for error", async () => {
    const sleepCalls: number[] = [];
    const onOk = vi.fn(async () => "ok-value");
    const onError = vi.fn(async () => "error-value");

    const result = await runReadScenario(READ_OUTCOME.ERROR, buildDeps(sleepCalls), onOk, onError);

    expect(result).toBe("error-value");
    expect(sleepCalls).toEqual([READ_LATENCY_MS[0]]);
    expect(onOk).not.toHaveBeenCalled();
  });

  it("throws for an outcome outside the union", async () => {
    const invalid = "unknown" as unknown as ReadOutcome;

    await expect(
      runReadScenario(
        invalid,
        buildDeps([]),
        async () => "ok-value",
        async () => "error-value",
      ),
    ).rejects.toThrow();
  });
});

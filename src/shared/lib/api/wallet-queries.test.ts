import { describe, expect, it } from "vitest";
import {
  MOVEMENT_FILTER,
  movementsInfiniteQueryOptions,
  parseMovementFilter,
  walletQueryKeys,
  walletSummaryQueryOptions,
} from "./wallet-queries";

describe("parseMovementFilter", () => {
  it("maps debit and credit to themselves", () => {
    expect(parseMovementFilter("debit")).toBe(MOVEMENT_FILTER.DEBIT);
    expect(parseMovementFilter("credit")).toBe(MOVEMENT_FILTER.CREDIT);
  });

  it("maps null and any unknown value to all", () => {
    expect(parseMovementFilter(null)).toBe(MOVEMENT_FILTER.ALL);
    expect(parseMovementFilter("x")).toBe(MOVEMENT_FILTER.ALL);
    expect(parseMovementFilter("")).toBe(MOVEMENT_FILTER.ALL);
  });
});

describe("walletQueryKeys", () => {
  it("builds stable keys for the summary and each filter", () => {
    expect(walletQueryKeys.summary()).toEqual(["wallet", "summary"]);
    expect(walletQueryKeys.movements(MOVEMENT_FILTER.CREDIT)).toEqual(["wallet", "movements", "credit"]);
  });
});

describe("walletSummaryQueryOptions", () => {
  it("uses the summary query key", () => {
    expect(walletSummaryQueryOptions().queryKey).toEqual(walletQueryKeys.summary());
  });
});

describe("movementsInfiniteQueryOptions", () => {
  it("starts with a null page param and reads nextCursor for the next page", () => {
    const options = movementsInfiniteQueryOptions(MOVEMENT_FILTER.ALL);

    expect(options.initialPageParam).toBeNull();
    expect(options.getNextPageParam?.({ items: [], nextCursor: "abc" }, [], null, [])).toBe("abc");
    expect(options.getNextPageParam?.({ items: [], nextCursor: null }, [], null, [])).toBeNull();
  });
});

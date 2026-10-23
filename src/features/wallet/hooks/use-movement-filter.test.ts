import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMovementFilter } from "./use-movement-filter";

const searchParamsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

function setLocation(search: string) {
  window.history.replaceState(null, "", `/home${search}`);
}

afterEach(() => {
  setLocation("");
});

describe("useMovementFilter", () => {
  it("reads the current filter from the direction query parameter", () => {
    setLocation("?direction=credit");
    searchParamsMock.mockReturnValue(new URLSearchParams("direction=credit"));

    const { result } = renderHook(() => useMovementFilter());

    expect(result.current[0]).toBe("credit");
  });

  it("defaults to all when there is no direction parameter", () => {
    setLocation("");
    searchParamsMock.mockReturnValue(new URLSearchParams(""));

    const { result } = renderHook(() => useMovementFilter());

    expect(result.current[0]).toBe("all");
  });

  it("pushes ?direction=credit without removing other params", () => {
    setLocation("?foo=bar");
    searchParamsMock.mockReturnValue(new URLSearchParams("foo=bar"));

    const { result } = renderHook(() => useMovementFilter());
    result.current[1]("credit");

    expect(window.location.search).toBe("?foo=bar&direction=credit");
  });

  it("removes the direction parameter when switching back to all", () => {
    setLocation("?direction=debit");
    searchParamsMock.mockReturnValue(new URLSearchParams("direction=debit"));

    const { result } = renderHook(() => useMovementFilter());
    result.current[1]("all");

    expect(window.location.search).toBe("");
  });
});

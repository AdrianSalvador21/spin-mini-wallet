import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNewRecipientMode } from "./use-new-recipient-mode";

const searchParamsMock = vi.fn(() => new URLSearchParams(window.location.search));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

function setLocation(search: string) {
  window.history.replaceState(null, "", `/transfers/new/recipient${search}`);
}

beforeEach(() => {
  setLocation("");
});

describe("useNewRecipientMode", () => {
  it("is closed without the mode param and open with mode=new", () => {
    expect(renderHook(() => useNewRecipientMode()).result.current.isNew).toBe(false);

    setLocation("?mode=new");

    expect(renderHook(() => useNewRecipientMode()).result.current.isNew).toBe(true);
  });

  it("ignores another mode value", () => {
    setLocation("?mode=edit");

    expect(renderHook(() => useNewRecipientMode()).result.current.isNew).toBe(false);
  });

  it("pushes ?mode=new without a navigation and keeps other params", () => {
    setLocation("?from=home");
    const pushState = vi.spyOn(window.history, "pushState");

    renderHook(() => useNewRecipientMode()).result.current.open();

    expect(pushState).toHaveBeenCalledWith(null, "", "?from=home&mode=new");
    pushState.mockRestore();
  });
});

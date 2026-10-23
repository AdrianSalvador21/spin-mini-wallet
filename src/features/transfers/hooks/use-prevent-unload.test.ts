import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePreventUnload } from "./use-prevent-unload";

function unloadIsAllowed(): boolean {
  return window.dispatchEvent(new Event("beforeunload", { cancelable: true }));
}

describe("usePreventUnload", () => {
  it("cancels beforeunload only while active", () => {
    const { rerender, unmount } = renderHook(({ active }) => usePreventUnload(active), {
      initialProps: { active: false },
    });

    expect(unloadIsAllowed()).toBe(true);

    rerender({ active: true });
    expect(unloadIsAllowed()).toBe(false);

    rerender({ active: false });
    expect(unloadIsAllowed()).toBe(true);

    rerender({ active: true });
    unmount();
    expect(unloadIsAllowed()).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { clearClientSession, onClientSessionClear, safeSessionStorage, SESSION_STORAGE_KEY } from "./client-session";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeStorageThrow() {
  const fail = () => {
    throw new DOMException("denied", "SecurityError");
  };

  vi.spyOn(Storage.prototype, "getItem").mockImplementation(fail);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(fail);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(fail);
}

describe("clearClientSession", () => {
  it("removes every session storage key", () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT, "{}");
    window.sessionStorage.setItem("other", "kept");

    clearClientSession();

    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT)).toBeNull();
    expect(window.sessionStorage.getItem("other")).toBe("kept");
  });

  it("notifies registered listeners until they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = onClientSessionClear(listener);

    clearClientSession();
    unsubscribe();
    clearClientSession();

    expect(listener).toHaveBeenCalledOnce();
  });

  it("survives a throwing sessionStorage", () => {
    makeStorageThrow();

    expect(() => clearClientSession()).not.toThrow();
  });
});

describe("safeSessionStorage", () => {
  it("reads and writes sessionStorage", () => {
    safeSessionStorage.setItem("key", "value");

    expect(safeSessionStorage.getItem("key")).toBe("value");

    safeSessionStorage.removeItem("key");

    expect(safeSessionStorage.getItem("key")).toBeNull();
  });

  it("answers null and swallows writes when sessionStorage throws", () => {
    makeStorageThrow();

    expect(safeSessionStorage.getItem("key")).toBeNull();
    expect(() => safeSessionStorage.setItem("key", "value")).not.toThrow();
    expect(() => safeSessionStorage.removeItem("key")).not.toThrow();
  });
});

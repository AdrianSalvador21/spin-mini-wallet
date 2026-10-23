import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, waitFor } from "@/test/render";
import { ApiFailureError } from "../api/api-client";
import { SESSION_STORAGE_KEY } from "../session-storage/client-session";
import { QueryProvider } from "./query-provider";

function Boom() {
  useQuery({
    queryKey: ["boom"],
    queryFn: async () => {
      throw new ApiFailureError({ kind: "api", status: 401, code: "UNAUTHORIZED", requestId: "req-1" });
    },
    retry: false,
  });

  return null;
}

function FailingMutation({ code }: { code: "UNAUTHORIZED" | "INTERNAL_ERROR" }) {
  const { mutate } = useMutation({
    mutationFn: async () => {
      throw new ApiFailureError({ kind: "api", status: 401, code, requestId: "req-2" });
    },
  });

  useEffect(() => {
    mutate();
  }, [mutate]);

  return null;
}

let replaceSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  replaceSpy = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, replace: replaceSpy },
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QueryProvider", () => {
  it("redirects to /session/end when a query fails with UNAUTHORIZED", async () => {
    renderWithProviders(
      <QueryProvider>
        <Boom />
      </QueryProvider>,
    );

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith("/session/end"));
  });

  it("clears the client session before redirecting on UNAUTHORIZED", async () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT, "{}");

    renderWithProviders(
      <QueryProvider>
        <Boom />
      </QueryProvider>,
    );

    await waitFor(() => expect(replaceSpy).toHaveBeenCalled());
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT)).toBeNull();
  });

  it("clears the client session and redirects to /session/end when a mutation fails with UNAUTHORIZED", async () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT, "{}");

    renderWithProviders(
      <QueryProvider>
        <FailingMutation code="UNAUTHORIZED" />
      </QueryProvider>,
    );

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith("/session/end"));
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT)).toBeNull();
  });

  it("does not redirect when a mutation fails with another code", async () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT, "{}");

    renderWithProviders(
      <QueryProvider>
        <FailingMutation code="INTERNAL_ERROR" />
      </QueryProvider>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY.TRANSFER_DRAFT)).toBe("{}");
    window.sessionStorage.clear();
  });
});

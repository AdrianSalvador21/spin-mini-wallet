import { useQuery } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, waitFor } from "@/test/render";
import { ApiFailureError } from "../api/api-client";
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

let assignSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assignSpy = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, assign: assignSpy },
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QueryProvider", () => {
  it("redirects to /login when a query fails with UNAUTHORIZED", async () => {
    renderWithProviders(
      <QueryProvider>
        <Boom />
      </QueryProvider>,
    );

    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith("/login"));
  });
});

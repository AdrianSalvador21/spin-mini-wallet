import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import type { ContactsList } from "@/shared/lib/api/views";
import { buildFavoriteContacts, MARIANA_PHONE } from "@/test/factories/contacts";
import { server } from "@/test/msw/server";
import { contactQueryKeys } from "./contact-queries";
import { useCreateContact } from "./use-create-contact";

const NEW_CLABE = "002123456789012343";

function setup(initialList: ContactsList | null = { items: buildFavoriteContacts() }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

  if (initialList) {
    queryClient.setQueryData(contactQueryKeys.list(), initialList);
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useCreateContact(), { wrapper });

  return { queryClient, result };
}

function cachedNames(queryClient: QueryClient): string[] | undefined {
  return queryClient.getQueryData<ContactsList>(contactQueryKeys.list())?.items.map((contact) => contact.name);
}

describe("useCreateContact", () => {
  it("writes a new favorite into the cached list in name order", async () => {
    const { queryClient, result } = setup();

    await act(() =>
      result.current.mutateAsync({
        name: "Beatriz Soto",
        account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: NEW_CLABE },
        saveAsFavorite: true,
      }),
    );

    expect(cachedNames(queryClient)).toEqual([
      "Ana Torres",
      "Beatriz Soto",
      "Carlos Ruiz",
      "Diego Ramírez",
      "Luis García",
    ]);
  });

  it("does not duplicate a contact that is already cached", async () => {
    const { queryClient, result } = setup();

    await act(() =>
      result.current.mutateAsync({
        name: "Carlos Ruiz",
        account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: "5523456789" },
        saveAsFavorite: true,
      }),
    );

    expect(cachedNames(queryClient)).toEqual(["Ana Torres", "Carlos Ruiz", "Diego Ramírez", "Luis García"]);
  });

  it("leaves the cached list alone for a non-favorite", async () => {
    const { queryClient, result } = setup();

    const contact = await act(() =>
      result.current.mutateAsync({
        name: "Beatriz Soto",
        account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: NEW_CLABE },
        saveAsFavorite: false,
      }),
    );

    expect(contact.isFavorite).toBe(false);
    expect(cachedNames(queryClient)).toEqual(["Ana Torres", "Carlos Ruiz", "Diego Ramírez", "Luis García"]);
  });

  it("does not create a list when none is cached", async () => {
    const { queryClient, result } = setup(null);

    await act(() =>
      result.current.mutateAsync({
        name: "Beatriz Soto",
        account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: NEW_CLABE },
        saveAsFavorite: true,
      }),
    );

    expect(cachedNames(queryClient)).toBeUndefined();
  });

  it("exposes the api failure with its details and does not retry", async () => {
    let calls = 0;
    server.events.on("request:start", () => {
      calls += 1;
    });
    const { result } = setup();

    act(() => {
      result.current.mutate({
        name: "Mariana López",
        account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: MARIANA_PHONE },
        saveAsFavorite: true,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    server.events.removeAllListeners();

    expect(result.current.error?.failure).toMatchObject({
      kind: "api",
      status: 400,
      details: { account: ["RECIPIENT_IS_SELF"] },
    });
    expect(calls).toBe(1);
  });

  it("exposes a 503 as an api failure", async () => {
    server.use(
      http.post("/api/v1/contacts", () =>
        HttpResponse.json(
          { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-9" } },
          { status: 503 },
        ),
      ),
    );
    const { result } = setup();

    act(() => {
      result.current.mutate({
        name: "Beatriz Soto",
        account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, clabe: NEW_CLABE },
        saveAsFavorite: true,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.failure).toMatchObject({ kind: "api", status: 503, requestId: "req-9" });
  });
});

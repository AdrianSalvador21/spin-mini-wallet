import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApiFailureError } from "@/shared/lib/api/api-client";
import { buildContact, buildFavoriteContacts } from "@/test/factories/contacts";
import { server } from "@/test/msw/server";
import { contactQueryKeys, contactsQueryOptions, upsertFavorite } from "./contact-queries";

describe("contactsQueryOptions", () => {
  it("uses the contacts list key", () => {
    expect(contactsQueryOptions().queryKey).toEqual(["contacts", "list"]);
    expect(contactQueryKeys.list()).toEqual([...contactQueryKeys.all, "list"]);
  });

  it("fetches the favorites", async () => {
    const queryClient = new QueryClient();

    const list = await queryClient.fetchQuery(contactsQueryOptions());

    expect(list.items.map((contact) => contact.name)).toEqual(buildFavoriteContacts().map((contact) => contact.name));
  });

  it("throws an ApiFailureError for a failed response", async () => {
    server.use(
      http.get("/api/v1/contacts", () =>
        HttpResponse.json(
          { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-1" } },
          { status: 503 },
        ),
      ),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await expect(queryClient.fetchQuery(contactsQueryOptions())).rejects.toBeInstanceOf(ApiFailureError);
  });
});

describe("upsertFavorite", () => {
  it("replaces an item with the same id instead of adding it twice", () => {
    const renamed = buildContact({ name: "Carlos R." });

    const list = upsertFavorite({ items: buildFavoriteContacts() }, renamed);

    expect(list.items.filter((contact) => contact.id === renamed.id)).toEqual([renamed]);
    expect(list.items).toHaveLength(4);
  });
});

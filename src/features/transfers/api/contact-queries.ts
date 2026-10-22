import { queryOptions } from "@tanstack/react-query";
import { apiGetOrThrow } from "@/shared/lib/api/api-client";
import type { ContactsList, ContactView } from "@/shared/lib/api/views";

export const CONTACTS_PATH = "/api/v1/contacts";

export const contactQueryKeys = {
  all: ["contacts"] as const,
  list: () => [...contactQueryKeys.all, "list"] as const,
};

export function contactsQueryOptions() {
  return queryOptions({
    queryKey: contactQueryKeys.list(),
    queryFn: ({ signal }) => apiGetOrThrow<ContactsList>(CONTACTS_PATH, signal),
  });
}

export function upsertFavorite(list: ContactsList, contact: ContactView): ContactsList {
  const others = list.items.filter((item) => item.id !== contact.id);

  return { items: [...others, contact].sort((a, b) => a.name.localeCompare(b.name)) };
}

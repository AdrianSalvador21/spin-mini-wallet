import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import type { newContactSchema } from "@/domain/contact/schemas";
import { ApiFailureError, apiPost } from "@/shared/lib/api/api-client";
import type { ContactsList, ContactView } from "@/shared/lib/api/views";
import { CONTACTS_PATH, contactQueryKeys, upsertFavorite } from "./contact-queries";

export type NewContactRequest = z.input<typeof newContactSchema>;

async function createContact(input: NewContactRequest): Promise<ContactView> {
  const result = await apiPost<ContactView>(CONTACTS_PATH, input);

  if (!result.ok) {
    throw new ApiFailureError(result.error);
  }

  return result.value;
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation<ContactView, ApiFailureError, NewContactRequest>({
    mutationFn: createContact,
    retry: false,
    onSuccess: (contact) => {
      if (!contact.isFavorite) {
        return;
      }

      queryClient.setQueryData<ContactsList>(contactQueryKeys.list(), (list) =>
        list ? upsertFavorite(list, contact) : list,
      );
    },
  });
}

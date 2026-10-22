import "server-only";
import type { z } from "zod";
import type { Contact, ContactId } from "@/domain/contact/types";
import type { newContactSchema } from "@/domain/contact/schemas";
import type { UserId } from "@/domain/user/types";
import { accountsMatch } from "./account-match";
import type { ServiceDependencies } from "./types";
import { toContactView, type ContactView } from "./views";

export interface ContactService {
  listFavorites(userId: UserId): Promise<ContactView[]>;
  create(userId: UserId, input: z.infer<typeof newContactSchema>): Promise<ContactView>;
}

export function createContactService({ db, now, createId }: ServiceDependencies): ContactService {
  return {
    async listFavorites(userId) {
      const contacts = await db.read((repositories) => repositories.contacts.listByOwnerId(userId));

      return contacts
        .filter((contact) => contact.isFavorite)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toContactView);
    },

    async create(userId, input) {
      return db.transaction((repositories) => {
        const existing = repositories.contacts
          .listByOwnerId(userId)
          .find((contact) => accountsMatch(contact.account, input.account));

        if (existing) {
          return toContactView(existing);
        }

        const contact: Contact = {
          id: `ctc_${createId()}` as ContactId,
          ownerId: userId,
          name: input.name,
          account: input.account,
          isFavorite: true,
          createdAt: now().toISOString(),
        };

        repositories.contacts.insert(contact);

        return toContactView(contact);
      });
    },
  };
}

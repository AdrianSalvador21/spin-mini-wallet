import "server-only";
import type { z } from "zod";
import { RECIPIENT_ACCOUNT_TYPE, type Contact, type ContactId } from "@/domain/contact/types";
import type { newContactSchema } from "@/domain/contact/schemas";
import { err, ok, type Result } from "@/domain/shared/result";
import type { UserId } from "@/domain/user/types";
import { accountsMatch } from "./account-match";
import { SERVICE_ERROR_CODE, type ServiceDependencies, type ServiceError } from "./types";
import { toContactView, type ContactView } from "./views";

export interface CreatedContact {
  contact: ContactView;
  created: boolean;
}

export interface ContactService {
  listFavorites(userId: UserId): Promise<ContactView[]>;
  create(userId: UserId, input: z.infer<typeof newContactSchema>): Promise<Result<CreatedContact, ServiceError>>;
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
      return db.transaction((repositories): Result<CreatedContact, ServiceError> => {
        const owner = repositories.users.findById(userId);

        if (!owner) {
          return err({ code: SERVICE_ERROR_CODE.NOT_FOUND });
        }

        if (input.account.type === RECIPIENT_ACCOUNT_TYPE.PHONE && input.account.phone === owner.phone) {
          return err({ code: SERVICE_ERROR_CODE.VALIDATION_ERROR, details: { account: ["RECIPIENT_IS_SELF"] } });
        }

        const existing = repositories.contacts
          .listByOwnerId(userId)
          .find((contact) => accountsMatch(contact.account, input.account));

        if (existing) {
          if (input.saveAsFavorite) {
            existing.isFavorite = true;
          }

          return ok({ contact: toContactView(existing), created: false });
        }

        const contact: Contact = {
          id: `ctc_${createId()}` as ContactId,
          ownerId: userId,
          name: input.name,
          account: input.account,
          isFavorite: input.saveAsFavorite,
          createdAt: now().toISOString(),
        };

        repositories.contacts.insert(contact);

        return ok({ contact: toContactView(contact), created: true });
      });
    },
  };
}

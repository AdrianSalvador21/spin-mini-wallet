import "server-only";
import type { Contact, ContactId } from "@/domain/contact/types";
import type { UserId } from "@/domain/user/types";
import type { DatabaseSnapshot } from "../db/schema";

export interface ContactsRepository {
  findById(id: ContactId): Contact | undefined;
  listByOwnerId(ownerId: UserId): Contact[];
  insert(contact: Contact): void;
}

export function createContactsRepository(snapshot: DatabaseSnapshot): ContactsRepository {
  return {
    findById(id) {
      return snapshot.contacts.find((contact) => contact.id === id);
    },
    listByOwnerId(ownerId) {
      return snapshot.contacts.filter((contact) => contact.ownerId === ownerId);
    },
    insert(contact) {
      snapshot.contacts.push(contact);
    },
  };
}

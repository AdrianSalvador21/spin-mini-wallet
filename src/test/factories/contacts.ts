import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import type { ContactView } from "@/shared/lib/api/views";

export const MARIANA_PHONE = "5512345678";

export function buildContact(overrides: Partial<ContactView> = {}): ContactView {
  return {
    id: "ctc_carlos" as ContactView["id"],
    name: "Carlos Ruiz",
    account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 6789" },
    isFavorite: true,
    ...overrides,
  };
}

export function buildFavoriteContacts(): ContactView[] {
  return [
    buildContact({
      id: "ctc_ana" as ContactView["id"],
      name: "Ana Torres",
      account: { type: RECIPIENT_ACCOUNT_TYPE.CLABE, masked: "•••• 5433", bankName: "Banamex" },
    }),
    buildContact(),
    buildContact({
      id: "ctc_diego" as ContactView["id"],
      name: "Diego Ramírez",
      account: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, masked: "•••• 4321" },
    }),
    buildContact({
      id: "ctc_luis" as ContactView["id"],
      name: "Luis García",
      account: { type: RECIPIENT_ACCOUNT_TYPE.CARD, masked: "•••• 1111" },
    }),
  ];
}

import { RECIPIENT_ACCOUNT_TYPE, type RecipientAccount } from "@/domain/contact/types";

export const NEW_RECIPIENT_FIELD = {
  NAME: "name",
  PHONE: "phone",
  CLABE: "clabe",
  CARD_NUMBER: "cardNumber",
} as const;

export type NewRecipientField = (typeof NEW_RECIPIENT_FIELD)[keyof typeof NEW_RECIPIENT_FIELD];

export const ACCOUNT_FIELD_BY_TYPE = {
  [RECIPIENT_ACCOUNT_TYPE.PHONE]: NEW_RECIPIENT_FIELD.PHONE,
  [RECIPIENT_ACCOUNT_TYPE.CLABE]: NEW_RECIPIENT_FIELD.CLABE,
  [RECIPIENT_ACCOUNT_TYPE.CARD]: NEW_RECIPIENT_FIELD.CARD_NUMBER,
} as const satisfies Record<RecipientAccount["type"], NewRecipientField>;

export const ACCOUNT_DETAIL_KEY = "account";

export const CLABE_LENGTH = 18;
export const CARD_LENGTH = 16;
export const BANK_PREFIX_LENGTH = 3;

export interface NewRecipientValues {
  type: RecipientAccount["type"];
  name: string;
  phone: string;
  clabe: string;
  cardNumber: string;
  saveAsFavorite: boolean;
}

export const SERVER_ERROR_TYPE = "server";
export const BAD_REQUEST_STATUS = 400;

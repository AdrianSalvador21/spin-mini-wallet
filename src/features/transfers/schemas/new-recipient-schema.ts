import type { FieldErrors, Resolver } from "react-hook-form";
import { newContactSchema } from "@/domain/contact/schemas";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import type { NewContactRequest } from "../api/use-create-contact";
import {
  ACCOUNT_DETAIL_KEY,
  ACCOUNT_FIELD_BY_TYPE,
  NEW_RECIPIENT_FIELD,
  type NewRecipientField,
  type NewRecipientValues,
} from "../components/new-recipient-form/types";

const FIELD_NAMES: readonly string[] = Object.values(NEW_RECIPIENT_FIELD);

export function toNewContactRequest(values: NewRecipientValues): NewContactRequest {
  const base = { name: values.name, saveAsFavorite: values.saveAsFavorite };

  switch (values.type) {
    case RECIPIENT_ACCOUNT_TYPE.PHONE:
      return { ...base, account: { type: values.type, phone: values.phone } };
    case RECIPIENT_ACCOUNT_TYPE.CLABE:
      return { ...base, account: { type: values.type, clabe: values.clabe } };
    case RECIPIENT_ACCOUNT_TYPE.CARD:
      return { ...base, account: { type: values.type, cardNumber: values.cardNumber } };
    default:
      return assertUnreachable(values.type);
  }
}

export function fieldForDetail(detailKey: string, type: NewRecipientValues["type"]): NewRecipientField | null {
  if (detailKey === ACCOUNT_DETAIL_KEY) {
    return ACCOUNT_FIELD_BY_TYPE[type];
  }

  const last = detailKey.split(".").at(-1) ?? "";

  return FIELD_NAMES.includes(last) ? (last as NewRecipientField) : null;
}

export const newRecipientResolver: Resolver<NewRecipientValues> = async (values) => {
  const result = newContactSchema.safeParse(toNewContactRequest(values));

  if (result.success) {
    return { values, errors: {} };
  }

  const errors: FieldErrors<NewRecipientValues> = {};

  for (const issue of result.error.issues) {
    const field = fieldForDetail(issue.path.map(String).join("."), values.type);

    if (field && !errors[field]) {
      errors[field] = { type: issue.code, message: issue.message };
    }
  }

  return { values: {}, errors };
};

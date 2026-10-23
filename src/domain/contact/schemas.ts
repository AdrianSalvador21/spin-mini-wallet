import { z } from "zod";
import { fromValidator } from "../shared/validation";
import { validateFullName, validatePhone } from "../user/validators";
import { RECIPIENT_ACCOUNT_TYPE } from "./types";
import { validateCardNumber, validateClabe } from "./validators";

const nameSchema = fromValidator(validateFullName);
const phoneSchema = fromValidator(validatePhone);
const clabeSchema = fromValidator(validateClabe);
const cardNumberSchema = fromValidator(validateCardNumber);

export const recipientAccountSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(RECIPIENT_ACCOUNT_TYPE.PHONE), phone: phoneSchema }),
  z.object({ type: z.literal(RECIPIENT_ACCOUNT_TYPE.CLABE), clabe: clabeSchema }),
  z.object({ type: z.literal(RECIPIENT_ACCOUNT_TYPE.CARD), cardNumber: cardNumberSchema }),
]);

export const newContactSchema = z.object({
  name: nameSchema,
  account: recipientAccountSchema,
  saveAsFavorite: z.boolean(),
});

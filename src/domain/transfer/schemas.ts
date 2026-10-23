import { z } from "zod";
import { recipientAccountSchema } from "../contact/schemas";
import { parseAmount, validateAmountInCents } from "../money/money";
import { fromValidator } from "../shared/validation";
import { validateFullName } from "../user/validators";
import { TRANSFER_RECIPIENT_KIND } from "./types";
import { validateConcept } from "./validators";

const recipientNameSchema = fromValidator(validateFullName);
const conceptSchema = fromValidator(validateConcept).optional();

const transferRecipientInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(TRANSFER_RECIPIENT_KIND.CONTACT), contactId: z.string() }),
  z.object({
    kind: z.literal(TRANSFER_RECIPIENT_KIND.NEW),
    name: recipientNameSchema,
    account: recipientAccountSchema,
    saveAsFavorite: z.boolean(),
  }),
]);

export const transferAmountSchema = z.object({ amount: z.string() }).transform((data, ctx) => {
  const result = parseAmount(data.amount);

  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.error, path: ["amount"] });
    return z.NEVER;
  }

  return { amountInCents: result.value };
});

const amountInCentsSchema = z.number().transform((value, ctx) => {
  const result = validateAmountInCents(value);

  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }

  return result.value;
});

export const createTransferSchema = z.object({
  amountInCents: amountInCentsSchema,
  recipient: transferRecipientInputSchema,
  concept: conceptSchema,
});

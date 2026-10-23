import { z } from "zod";
import type { ContactId } from "../contact/types";
import { parseAmount, validateAmountInCents } from "../money/money";
import { fromValidator } from "../shared/validation";
import { validateConcept } from "./validators";

const conceptSchema = fromValidator(validateConcept).optional();

const transferRecipientSchema = z.object({
  contactId: z
    .string()
    .min(1)
    .transform((value) => value as ContactId),
});

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
  recipient: transferRecipientSchema,
  concept: conceptSchema,
});

import { z } from "zod";
import type { ValidationCode } from "@/domain/shared/validation-codes";

const RECIPIENT_REQUIRED: ValidationCode = "RECIPIENT_REQUIRED";

export const recipientStepSchema = z.object({
  contactId: z.string().min(1, { message: RECIPIENT_REQUIRED }),
});

export type RecipientStepValues = z.infer<typeof recipientStepSchema>;

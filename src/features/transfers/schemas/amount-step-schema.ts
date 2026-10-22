import { z } from "zod";
import { parseAmount, toMoney, type Money } from "@/domain/money/money";
import { validateTransferAmount } from "@/domain/transfer/rules";
import { validateConcept } from "@/domain/transfer/validators";
import { fromValidator } from "@/domain/shared/validation";

export function createAmountStepSchema(balance: Money | null) {
  return z.object({
    amount: z.string().transform((value, ctx) => {
      const parsed = parseAmount(value);

      if (!parsed.ok) {
        ctx.addIssue({ code: "custom", message: parsed.error });
        return z.NEVER;
      }

      if (balance) {
        const rule = validateTransferAmount(toMoney(parsed.value), balance);

        if (!rule.ok) {
          ctx.addIssue({ code: "custom", message: rule.error[0] });
          return z.NEVER;
        }
      }

      return parsed.value;
    }),
    concept: fromValidator(validateConcept),
  });
}

export type AmountStepSchema = ReturnType<typeof createAmountStepSchema>;
export type AmountStepInput = z.input<AmountStepSchema>;
export type AmountStepOutput = z.output<AmountStepSchema>;

import { useTranslations } from "next-intl";
import { VALIDATION_CODES, type ValidationCode } from "@/domain/shared/validation-codes";

function isValidationCode(value: string): value is ValidationCode {
  return (VALIDATION_CODES as readonly string[]).includes(value);
}

export function useValidationMessage(): (code: string | undefined) => string | undefined {
  const t = useTranslations("errors.validation");

  return (code) => (code !== undefined && isValidationCode(code) ? t(code) : undefined);
}

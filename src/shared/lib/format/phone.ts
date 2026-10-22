const PHONE_DIGITS = 10;
const GROUP_BOUNDARIES = [2, 6] as const;

export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, PHONE_DIGITS);
  const [first, second] = GROUP_BOUNDARIES;
  return [digits.slice(0, first), digits.slice(first, second), digits.slice(second)]
    .filter((group) => group.length > 0)
    .join(" ");
}

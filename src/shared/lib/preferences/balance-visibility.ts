export const BALANCE_VISIBILITY_COOKIE = "smw_balance_hidden";

const HIDDEN_VALUE = "1";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isBalanceHidden(value: string | undefined): boolean {
  return value === HIDDEN_VALUE;
}

export function writeBalanceHidden(hidden: boolean): void {
  if (hidden) {
    document.cookie = `${BALANCE_VISIBILITY_COOKIE}=${HIDDEN_VALUE}; Path=/; SameSite=Lax; Max-Age=${ONE_YEAR_SECONDS}`;
  } else {
    document.cookie = `${BALANCE_VISIBILITY_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
  }
}

import { useQuery } from "@tanstack/react-query";
import { subtractMoney, toMoney, type Cents, type Money } from "@/domain/money/money";
import { TRANSFER_FEE } from "@/domain/transfer/fees";
import { walletSummaryQueryOptions } from "@/shared/lib/api/wallet-queries";
import { useTransferDraft } from "../draft/draft-store";

export function computeBalanceAfter(balance: Money, amountInCents: Cents): Money {
  return subtractMoney(subtractMoney(balance, toMoney(amountInCents)), TRANSFER_FEE);
}

export function useTransferBalance() {
  const summary = useQuery(walletSummaryQueryOptions());
  const amountInCents = useTransferDraft((draft) => draft.amountInCents);
  const balance = summary.data?.balance ?? null;
  const balanceAfter = balance && amountInCents !== null ? computeBalanceAfter(balance, amountInCents) : null;

  return { summary, balance, balanceAfter };
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AmountStep } from "@/features/transfers/components/amount-step/amount-step";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transfers.metaTitles");

  return { title: t("amount") };
}

export default function TransferAmountPage() {
  return <AmountStep />;
}

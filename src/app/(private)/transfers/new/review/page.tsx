import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TransferConfirmation } from "@/features/transfers/components/transfer-confirmation/transfer-confirmation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transfers.metaTitles");

  return { title: t("review") };
}

export default function TransferReviewPage() {
  return <TransferConfirmation />;
}

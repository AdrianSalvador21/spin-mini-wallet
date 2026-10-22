import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReviewStep } from "@/features/transfers/components/review-step/review-step";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transfers.metaTitles");

  return { title: t("review") };
}

export default function TransferReviewPage() {
  return <ReviewStep />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RecipientStep } from "@/features/transfers/components/recipient-step/recipient-step";
import { WizardSkeleton } from "@/features/transfers/components/wizard-skeleton/wizard-skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transfers.metaTitles");

  return { title: t("recipient") };
}

export default function TransferRecipientPage() {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      <RecipientStep />
    </Suspense>
  );
}

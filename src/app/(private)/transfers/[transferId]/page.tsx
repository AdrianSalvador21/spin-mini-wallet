import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ReceiptSkeleton } from "@/features/transfers/components/receipt-skeleton/receipt-skeleton";
import { ReceiptSection } from "./_sections/receipt-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transfers.metaTitles");

  return { title: t("receipt") };
}

export default function TransferReceiptPage({ params }: PageProps<"/transfers/[transferId]">) {
  return (
    <div className="mx-auto flex w-full max-w-focus flex-1 flex-col lg:flex-none lg:py-8">
      <Suspense fallback={<ReceiptSkeleton />}>
        <ReceiptSection params={params} />
      </Suspense>
    </div>
  );
}

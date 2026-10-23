import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ReceiptSkeleton } from "@/features/transfers/components/receipt-skeleton/receipt-skeleton";
import { BrandRings } from "@/shared/ui/brand-rings/brand-rings";
import { RINGS_PLACEMENT, RINGS_SIZE } from "@/shared/ui/brand-rings/types";
import { ReceiptSection } from "./_sections/receipt-section";
import styles from "./page.module.scss";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transfers.metaTitles");

  return { title: t("receipt") };
}

export default function TransferReceiptPage({ params }: PageProps<"/transfers/[transferId]">) {
  return (
    <div className={styles["receipt-page"]}>
      <div className={styles["receipt-page__texture"]}>
        <BrandRings placement={RINGS_PLACEMENT.TOP_LEFT} size={RINGS_SIZE.MD} />
      </div>
      <div
        className={`${styles["receipt-page__content"]} mx-auto flex w-full max-w-focus flex-1 flex-col lg:flex-none lg:py-8`}
      >
        <Suspense fallback={<ReceiptSkeleton />}>
          <ReceiptSection params={params} />
        </Suspense>
      </div>
    </div>
  );
}

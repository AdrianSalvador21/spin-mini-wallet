import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MovementsSkeleton } from "@/features/wallet/components/movements-skeleton/movements-skeleton";
import { SummarySkeleton } from "@/features/wallet/components/summary-skeleton/summary-skeleton";
import { BlockErrorBoundary } from "@/shared/ui/block-error-boundary/block-error-boundary";
import { MovementsSection } from "./_sections/movements-section";
import { SummarySection } from "./_sections/summary-section";
import styles from "./page.module.scss";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");

  return { title: t("metaTitle") };
}

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const t = await getTranslations("common.blockError");

  return (
    <div className={styles["home-page"]}>
      <BlockErrorBoundary title={t("title")} retryLabel={t("retry")}>
        <Suspense fallback={<SummarySkeleton />}>
          <SummarySection />
        </Suspense>
      </BlockErrorBoundary>

      <BlockErrorBoundary title={t("title")} retryLabel={t("retry")}>
        <Suspense fallback={<MovementsSkeleton />}>
          <MovementsSection searchParams={searchParams} />
        </Suspense>
      </BlockErrorBoundary>
    </div>
  );
}

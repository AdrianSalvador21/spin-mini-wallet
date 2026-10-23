import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import styles from "./receipt-skeleton.module.scss";
import { RECEIPT_SKELETON_ROWS, RECEIPT_SKELETON_WIDTH } from "./types";

export function ReceiptSkeleton() {
  return (
    <div className={styles["receipt-skeleton"]} data-testid="receipt-skeleton">
      <div className={styles["receipt-skeleton__head"]}>
        <Skeleton shape={SKELETON_SHAPE.CIRCLE} size={SKELETON_SIZE.LG} />
        <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width={RECEIPT_SKELETON_WIDTH.TITLE} />
        <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width={RECEIPT_SKELETON_WIDTH.AMOUNT} />
        <Skeleton shape={SKELETON_SHAPE.LINE} width={RECEIPT_SKELETON_WIDTH.DATE} />
      </div>
      <div className={styles["receipt-skeleton__rows"]}>
        {Array.from({ length: RECEIPT_SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} shape={SKELETON_SHAPE.LINE} width={RECEIPT_SKELETON_WIDTH.ROW} />
        ))}
      </div>
    </div>
  );
}

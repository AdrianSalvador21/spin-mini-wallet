import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import styles from "./summary-skeleton.module.scss";

export function SummarySkeleton() {
  return (
    <div className={styles["summary-skeleton"]} aria-hidden="true">
      <Skeleton shape={SKELETON_SHAPE.CIRCLE} size={SKELETON_SIZE.SM} />
      <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.MD} width="40%" />
      <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width="60%" />
    </div>
  );
}

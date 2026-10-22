import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE } from "@/shared/ui/skeleton/types";
import styles from "./movements-skeleton.module.scss";

const DEFAULT_ROWS = 5;

interface MovementsSkeletonProps {
  rows?: number;
}

export function MovementsSkeleton({ rows = DEFAULT_ROWS }: MovementsSkeletonProps) {
  return (
    <ul className={styles["movements-skeleton"]} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className={styles["movements-skeleton__row"]}>
          <Skeleton shape={SKELETON_SHAPE.TILE} />
          <Skeleton shape={SKELETON_SHAPE.LINE} width="60%" />
        </li>
      ))}
    </ul>
  );
}

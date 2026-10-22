import movementListStyles from "@/features/wallet/components/movement-list/movement-list.module.scss";
import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import styles from "./movements-skeleton.module.scss";

const DEFAULT_ROWS = 5;

interface MovementsSkeletonProps {
  rows?: number;
  fullCard?: boolean;
}

function MovementRows({ rows }: { rows: number }) {
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

export function MovementsSkeleton({ rows = DEFAULT_ROWS, fullCard = false }: MovementsSkeletonProps) {
  if (!fullCard) {
    return <MovementRows rows={rows} />;
  }

  return (
    <section
      className={`${movementListStyles["movement-list"]} ${styles["movements-skeleton__page"]}`}
      aria-hidden="true"
    >
      <div className={movementListStyles["movement-list__header"]}>
        <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width="40%" />
        <Skeleton shape={SKELETON_SHAPE.PILL} className={styles["movements-skeleton__filter"]} />
      </div>
      <MovementRows rows={rows} />
    </section>
  );
}

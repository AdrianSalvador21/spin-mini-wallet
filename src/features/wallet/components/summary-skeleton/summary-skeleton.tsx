import balanceCardStyles from "@/features/wallet/components/balance-card/balance-card.module.scss";
import homeHeaderStyles from "@/features/wallet/components/home-header/home-header.module.scss";
import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import styles from "./summary-skeleton.module.scss";

export function SummarySkeleton() {
  return (
    <>
      <header
        className={`${homeHeaderStyles["home-header"]} ${styles["summary-skeleton__header"]}`}
        aria-hidden="true"
      >
        <div className={homeHeaderStyles["home-header__mobile"]}>
          <div className={styles["summary-skeleton__lines"]}>
            <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.SM} width="30%" />
            <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.MD} width="55%" />
          </div>
          <Skeleton shape={SKELETON_SHAPE.CIRCLE} size={SKELETON_SIZE.SM} />
        </div>
        <div className={homeHeaderStyles["home-header__desktop"]}>
          <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width="40%" />
          <Skeleton
            shape={SKELETON_SHAPE.LINE}
            size={SKELETON_SIZE.MD}
            width="30%"
            className={styles["summary-skeleton__spaced"]}
          />
        </div>
      </header>
      <section
        className={`${balanceCardStyles["balance-card"]} ${styles["summary-skeleton__aside"]}`}
        aria-hidden="true"
      >
        <div className={balanceCardStyles["balance-card__row"]}>
          <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.SM} width="45%" />
          <Skeleton shape={SKELETON_SHAPE.CIRCLE} size={SKELETON_SIZE.SM} />
        </div>
        <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width="60%" />
        <Skeleton shape={SKELETON_SHAPE.PILL} />
      </section>
    </>
  );
}

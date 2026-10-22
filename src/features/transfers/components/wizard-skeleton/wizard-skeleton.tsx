import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import styles from "./wizard-skeleton.module.scss";

export function WizardSkeleton() {
  return (
    <div className={styles["wizard-skeleton"]} data-testid="wizard-skeleton">
      <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width="60%" />
      <Skeleton shape={SKELETON_SHAPE.LINE} width="40%" />
      <Skeleton shape={SKELETON_SHAPE.LINE} width="80%" />
    </div>
  );
}

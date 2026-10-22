import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import styles from "./wizard-skeleton.module.scss";
import { WIZARD_SKELETON_WIDTH } from "./types";

export function WizardSkeleton() {
  return (
    <div className={styles["wizard-skeleton"]} data-testid="wizard-skeleton">
      <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.LG} width={WIZARD_SKELETON_WIDTH.TITLE} />
      <Skeleton shape={SKELETON_SHAPE.LINE} width={WIZARD_SKELETON_WIDTH.SUBTITLE} />
      <Skeleton shape={SKELETON_SHAPE.LINE} width={WIZARD_SKELETON_WIDTH.BODY} />
    </div>
  );
}

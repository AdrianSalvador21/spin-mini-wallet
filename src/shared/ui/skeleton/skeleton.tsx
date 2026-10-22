import type { CSSProperties } from "react";
import styles from "./skeleton.module.scss";
import { SKELETON_SIZE, type SkeletonShape, type SkeletonSize } from "./types";

interface SkeletonProps {
  shape: SkeletonShape;
  size?: SkeletonSize;
  width?: string;
  className?: string;
}

export function Skeleton({ shape, size = SKELETON_SIZE.MD, width, className }: SkeletonProps) {
  const classNames = [styles.skeleton, styles[`skeleton--${shape}`], styles[`skeleton--${size}`], className]
    .filter(Boolean)
    .join(" ");
  const style: CSSProperties | undefined = width ? { width } : undefined;

  return <span className={classNames} style={style} aria-hidden="true" />;
}

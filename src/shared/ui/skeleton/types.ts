export const SKELETON_SHAPE = {
  LINE: "line",
  TILE: "tile",
  CIRCLE: "circle",
  PILL: "pill",
} as const;

export type SkeletonShape = (typeof SKELETON_SHAPE)[keyof typeof SKELETON_SHAPE];

export const SKELETON_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg",
} as const;

export type SkeletonSize = (typeof SKELETON_SIZE)[keyof typeof SKELETON_SIZE];

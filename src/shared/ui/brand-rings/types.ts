export const RINGS_PLACEMENT = {
  TOP_RIGHT: "top-right",
  BOTTOM_RIGHT: "bottom-right",
  BOTTOM_LEFT: "bottom-left",
  TOP_LEFT: "top-left",
} as const;

export type RingsPlacement = (typeof RINGS_PLACEMENT)[keyof typeof RINGS_PLACEMENT];

export const RINGS_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg",
} as const;

export type RingsSize = (typeof RINGS_SIZE)[keyof typeof RINGS_SIZE];

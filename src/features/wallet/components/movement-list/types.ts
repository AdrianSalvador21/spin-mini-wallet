export const MOVEMENTS_VIEW_KIND = {
  LOADING: "loading",
  ERROR: "error",
  EMPTY: "empty",
  EMPTY_FILTERED: "empty_filtered",
  LIST: "list",
} as const;

export type MovementsViewKind = (typeof MOVEMENTS_VIEW_KIND)[keyof typeof MOVEMENTS_VIEW_KIND];

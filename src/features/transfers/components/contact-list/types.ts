export const CONTACT_LIST_STATE = {
  LOADING: "loading",
  ERROR: "error",
  EMPTY: "empty",
  LIST: "list",
} as const;

export type ContactListState = (typeof CONTACT_LIST_STATE)[keyof typeof CONTACT_LIST_STATE];

export const CONTACT_SKELETON_ROWS = 3;

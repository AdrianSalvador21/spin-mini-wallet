export const STEP_STATE = {
  DONE: "done",
  CURRENT: "current",
  UPCOMING: "upcoming",
} as const;

export type StepState = (typeof STEP_STATE)[keyof typeof STEP_STATE];

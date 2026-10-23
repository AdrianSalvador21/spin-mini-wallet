export const OUTCOME_TONE = {
  DANGER: "danger",
  WARNING: "warning",
} as const;

export type OutcomeTone = (typeof OUTCOME_TONE)[keyof typeof OUTCOME_TONE];

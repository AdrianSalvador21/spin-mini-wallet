export const COPY_FEEDBACK_MS = 2000;

export const COPY_FEEDBACK = {
  IDLE: "idle",
  COPIED: "copied",
  FAILED: "failed",
} as const;

export type CopyFeedback = (typeof COPY_FEEDBACK)[keyof typeof COPY_FEEDBACK];

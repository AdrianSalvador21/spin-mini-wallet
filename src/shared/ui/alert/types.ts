export const ALERT_TONE = {
  DANGER: "danger",
  WARNING: "warning",
  SUCCESS: "success",
  INFO: "info",
} as const;

export type AlertTone = (typeof ALERT_TONE)[keyof typeof ALERT_TONE];

export const ALERT_ROLE = {
  ALERT: "alert",
  STATUS: "status",
} as const;

export type AlertRole = (typeof ALERT_ROLE)[keyof typeof ALERT_ROLE];

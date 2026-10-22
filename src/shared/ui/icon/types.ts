export const ICON_NAME = {
  ALERT: "alert",
  CHECK: "check",
  CLOCK: "clock",
  EYE: "eye",
  EYE_OFF: "eye-off",
  BACK: "back",
  PHONE: "phone",
  RECEIPT: "receipt",
  SHIELD: "shield",
} as const;

export type IconName = (typeof ICON_NAME)[keyof typeof ICON_NAME];

export const ICON_SIZE = {
  SM: "sm",
  MD: "md",
} as const;

export type IconSize = (typeof ICON_SIZE)[keyof typeof ICON_SIZE];

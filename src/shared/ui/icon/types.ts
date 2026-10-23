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
  SEND: "send",
  ARROW_IN: "arrow-in",
  STORE: "store",
  INBOX: "inbox",
  HOME: "home",
  USERS: "users",
  LOGOUT: "logout",
  PLUS: "plus",
  SHARE: "share",
  WIFI: "wifi",
  WALLET: "wallet",
  COPY: "copy",
  CLOSE: "close",
} as const;

export type IconName = (typeof ICON_NAME)[keyof typeof ICON_NAME];

export const ICON_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg",
  XL: "xl",
} as const;

export type IconSize = (typeof ICON_SIZE)[keyof typeof ICON_SIZE];

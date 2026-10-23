export const AVATAR_SIZE = {
  MD: "md",
  TOUCH: "touch",
  LG: "lg",
} as const;

export type AvatarSize = (typeof AVATAR_SIZE)[keyof typeof AVATAR_SIZE];

export const AVATAR_TONE = {
  ON_BRAND: "on-brand",
  SOFT: "soft",
} as const;

export type AvatarTone = (typeof AVATAR_TONE)[keyof typeof AVATAR_TONE];

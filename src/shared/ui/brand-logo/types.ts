export const BRAND_LOGO_SIZE = {
  MD: "md",
  LG: "lg",
} as const;

export type BrandLogoSize = (typeof BRAND_LOGO_SIZE)[keyof typeof BRAND_LOGO_SIZE];

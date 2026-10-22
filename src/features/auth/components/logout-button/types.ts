export const LOGOUT_BUTTON_VARIANT = {
  NAV_ITEM: "nav-item",
  MENU_ITEM: "menu-item",
} as const;

export type LogoutButtonVariant = (typeof LOGOUT_BUTTON_VARIANT)[keyof typeof LOGOUT_BUTTON_VARIANT];

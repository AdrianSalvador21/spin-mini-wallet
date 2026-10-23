import type { ReactNode } from "react";
import styles from "./icon.module.scss";
import { ICON_NAME, ICON_SIZE, type IconName, type IconSize } from "./types";

const EYE_OUTLINE = (
  <>
    <path
      d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
  </>
);

const ICON_PATHS: Record<IconName, ReactNode> = {
  [ICON_NAME.ALERT]: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v6M12 16.5v.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  [ICON_NAME.CHECK]: (
    <path
      d="M5 12.5l4.5 4.5L19 7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  [ICON_NAME.CLOCK]: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  [ICON_NAME.EYE]: EYE_OUTLINE,
  [ICON_NAME.EYE_OFF]: (
    <>
      {EYE_OUTLINE}
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  [ICON_NAME.BACK]: (
    <path
      d="M15 5l-7 7 7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  [ICON_NAME.PHONE]: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M11 17.5h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  [ICON_NAME.RECEIPT]: (
    <path
      d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  [ICON_NAME.SHIELD]: (
    <>
      <path
        d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5C7.7 19.5 4.5 16 4.5 11.5V6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2.2 2.2L15.5 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  [ICON_NAME.SEND]: (
    <path
      d="M3 11l18-8-8 18-3-7-7-3z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  [ICON_NAME.ARROW_IN]: (
    <path
      d="M17 7L7 17M7 17v-7M7 17h7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  [ICON_NAME.STORE]: (
    <>
      <path d="M4 9l1-5h14l1 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 9v10h16V9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 19v-5h6v5" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  [ICON_NAME.INBOX]: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 13h5l1.5 2.5h5L16 13h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </>
  ),
  [ICON_NAME.HOME]: (
    <path
      d="M4 11.5L12 4l8 7.5M6 10v9h12v-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  [ICON_NAME.USERS]: (
    <>
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15 19c0-2.2 1.3-4 3.2-4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
  [ICON_NAME.LOGOUT]: (
    <>
      <path
        d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 8l5 4-5 4M19 12H9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  [ICON_NAME.PLUS]: <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
  [ICON_NAME.SHARE]: (
    <path
      d="M12 4v11M7.5 8.5L12 4l4.5 4.5M5 14v5h14v-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  [ICON_NAME.WIFI]: (
    <>
      <path
        d="M3 9a14 14 0 0118 0M6.5 12.5a9 9 0 0111 0M10 16a4 4 0 014 0M4 4l16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" />
    </>
  ),
  [ICON_NAME.WALLET]: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 12.5h2M3 9.5h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  [ICON_NAME.COPY]: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M15 5.5A1.5 1.5 0 0013.5 4h-8A1.5 1.5 0 004 5.5v8A1.5 1.5 0 005.5 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: IconSize;
  label?: string;
  className?: string;
}

export function Icon({ name, size = ICON_SIZE.MD, label, className }: IconProps) {
  const accessibility = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };

  return (
    <svg
      viewBox="0 0 24 24"
      focusable="false"
      className={[styles.icon, styles[`icon--${size}`], className].filter(Boolean).join(" ")}
      {...accessibility}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

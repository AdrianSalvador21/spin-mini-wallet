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

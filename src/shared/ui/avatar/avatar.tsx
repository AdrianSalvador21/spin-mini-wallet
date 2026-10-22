import styles from "./avatar.module.scss";
import { type AvatarSize, type AvatarTone } from "./types";

interface AvatarProps {
  initials: string;
  size: AvatarSize;
  tone: AvatarTone;
  className?: string;
}

export function Avatar({ initials, size, tone, className }: AvatarProps) {
  const classNames = [styles.avatar, styles[`avatar--${size}`], styles[`avatar--${tone}`], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames} aria-hidden="true">
      {initials}
    </span>
  );
}

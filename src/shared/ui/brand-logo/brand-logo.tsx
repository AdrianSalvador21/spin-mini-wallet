import Image from "next/image";
import { useTranslations } from "next-intl";
import styles from "./brand-logo.module.scss";
import { BRAND_LOGO_SIZE, type BrandLogoSize } from "./types";

const LOGO_SRC = "/assets/shared/spin-oxxo-logo.svg";
const LOGO_WIDTH = 112;
const LOGO_HEIGHT = 82;

interface BrandLogoProps {
  onDark?: boolean;
  priority?: boolean;
  size?: BrandLogoSize;
  className?: string;
}

export function BrandLogo({ onDark = false, priority = false, size = BRAND_LOGO_SIZE.MD, className }: BrandLogoProps) {
  const t = useTranslations("common.brand");

  const classNames = [
    styles["brand-logo"],
    styles[`brand-logo--${size}`],
    onDark && styles["brand-logo--on-dark"],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Image
      src={LOGO_SRC}
      alt={t("logoAlt")}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={classNames}
    />
  );
}

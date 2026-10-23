import Image from "next/image";
import styles from "./brand-rings.module.scss";
import type { RingsPlacement, RingsSize } from "./types";

const RINGS_SRC = "/assets/shared/spin-rings.svg";
const RINGS_WIDTH = 700;
const RINGS_HEIGHT = 703;

interface BrandRingsProps {
  placement: RingsPlacement;
  size: RingsSize;
  className?: string;
}

export function BrandRings({ placement, size, className }: BrandRingsProps) {
  const classNames = [
    styles["brand-rings"],
    styles[`brand-rings--${placement}`],
    styles[`brand-rings--${size}`],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Image
      src={RINGS_SRC}
      alt=""
      aria-hidden="true"
      width={RINGS_WIDTH}
      height={RINGS_HEIGHT}
      className={classNames}
    />
  );
}

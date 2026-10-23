"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BrandLogo } from "@/shared/ui/brand-logo/brand-logo";
import { BRAND_LOGO_SIZE } from "@/shared/ui/brand-logo/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_SIZE, type IconName } from "@/shared/ui/icon/types";
import styles from "./side-nav.module.scss";

export interface SideNavItem {
  href: Route;
  label: string;
  icon: IconName;
}

interface SideNavProps {
  items: SideNavItem[];
  label: string;
  user?: ReactNode;
  footer?: ReactNode;
}

function isActive(pathname: string | null, href: string): boolean {
  return pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
}

interface SideNavListProps {
  items: SideNavItem[];
  pathname: string | null;
}

function SideNavList({ items, pathname }: SideNavListProps) {
  return (
    <ul className={styles["side-nav__list"]}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[styles["side-nav__item"], active && styles["side-nav__item--active"]]
                .filter(Boolean)
                .join(" ")}
            >
              <Icon name={item.icon} size={ICON_SIZE.MD} />
              <span className={styles["side-nav__label"]}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CurrentSideNavList({ items }: { items: SideNavItem[] }) {
  return <SideNavList items={items} pathname={usePathname()} />;
}

export function SideNav({ items, label, user, footer }: SideNavProps) {
  return (
    <nav aria-label={label} className={styles["side-nav"]}>
      <div className={styles["side-nav__logo"]}>
        <BrandLogo onDark size={BRAND_LOGO_SIZE.MD} />
      </div>
      {user && <div className={styles["side-nav__user"]}>{user}</div>}
      <Suspense fallback={<SideNavList items={items} pathname={null} />}>
        <CurrentSideNavList items={items} />
      </Suspense>
      {footer && <div className={styles["side-nav__footer"]}>{footer}</div>}
    </nav>
  );
}

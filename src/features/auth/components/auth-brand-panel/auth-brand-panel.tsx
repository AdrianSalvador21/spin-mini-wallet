import { useTranslations } from "next-intl";
import { BrandLogo } from "@/shared/ui/brand-logo/brand-logo";
import { BRAND_LOGO_SIZE } from "@/shared/ui/brand-logo/types";
import { BrandRings } from "@/shared/ui/brand-rings/brand-rings";
import { RINGS_PLACEMENT, RINGS_SIZE } from "@/shared/ui/brand-rings/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, type IconName } from "@/shared/ui/icon/types";
import styles from "./auth-brand-panel.module.scss";

const BRAND_PERK = {
  TRANSFERS: "transfers",
  RECEIPT: "receipt",
  SECURITY: "security",
} as const;

type BrandPerk = (typeof BRAND_PERK)[keyof typeof BRAND_PERK];

const PERKS: readonly { key: BrandPerk; icon: IconName }[] = [
  { key: BRAND_PERK.TRANSFERS, icon: ICON_NAME.PHONE },
  { key: BRAND_PERK.RECEIPT, icon: ICON_NAME.RECEIPT },
  { key: BRAND_PERK.SECURITY, icon: ICON_NAME.SHIELD },
];

export function AuthBrandPanel() {
  const t = useTranslations("auth.brand");

  return (
    <aside className={`${styles["auth-brand-panel"]} flex flex-1 flex-col px-14 py-12`}>
      <div className={styles["auth-brand-panel__texture"]}>
        <BrandRings placement={RINGS_PLACEMENT.TOP_RIGHT} size={RINGS_SIZE.LG} />
      </div>
      <BrandLogo onDark size={BRAND_LOGO_SIZE.LG} />
      <p className={`${styles["auth-brand-panel__headline"]} mt-auto`}>{t("headline")}</p>
      <p className={`${styles["auth-brand-panel__lead"]} mt-4`}>{t("lead")}</p>
      <ul className="mt-8 mb-auto flex flex-col gap-4">
        {PERKS.map((perk) => (
          <li key={perk.key} className={`${styles["auth-brand-panel__perk"]} flex items-center gap-3`}>
            <span className={styles["auth-brand-panel__perk-icon"]}>
              <Icon name={perk.icon} />
            </span>
            {t(`perks.${perk.key}`)}
          </li>
        ))}
      </ul>
      <p className={styles["auth-brand-panel__legal"]}>{t("legal")}</p>
    </aside>
  );
}

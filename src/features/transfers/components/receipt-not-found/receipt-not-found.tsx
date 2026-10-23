import { useTranslations } from "next-intl";
import { ROUTES } from "@/shared/lib/routes";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import { ICON_NAME } from "@/shared/ui/icon/types";
import { WizardState } from "../wizard-state/wizard-state";
import styles from "./receipt-not-found.module.scss";

export function ReceiptNotFound() {
  const t = useTranslations("transfers.receipt");

  return (
    <div className={styles["receipt-not-found"]}>
      <WizardState icon={ICON_NAME.RECEIPT} title={t("notFound.title")} text={t("notFound.text")} />
      <Button variant={BUTTON_VARIANT.PRIMARY} href={ROUTES.HOME}>
        {t("home")}
      </Button>
    </div>
  );
}

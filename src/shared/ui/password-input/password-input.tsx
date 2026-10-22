"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { Field, type FieldProps } from "@/shared/ui/field/field";
import { INPUT_TYPE } from "@/shared/ui/field/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME } from "@/shared/ui/icon/types";
import styles from "./password-input.module.scss";

type PasswordInputProps = Omit<FieldProps, "type" | "suffix">;

export function PasswordInput(props: PasswordInputProps) {
  const t = useTranslations("common.password");
  const [visible, setVisible] = useState(false);

  return (
    <Field
      {...props}
      type={visible ? INPUT_TYPE.TEXT : INPUT_TYPE.PASSWORD}
      suffix={
        <button
          type={BUTTON_TYPE.BUTTON}
          className={styles["password-input__toggle"]}
          aria-pressed={visible}
          aria-controls={props.id}
          aria-label={visible ? t("hide") : t("show")}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? ICON_NAME.EYE_OFF : ICON_NAME.EYE} />
        </button>
      }
    />
  );
}

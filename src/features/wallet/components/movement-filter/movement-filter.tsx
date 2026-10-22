"use client";

import { useTranslations } from "next-intl";
import { MOVEMENT_FILTER, type MovementFilter as MovementFilterValue } from "@/shared/lib/api/wallet-queries";
import { Segmented } from "@/shared/ui/segmented/segmented";

interface MovementFilterProps {
  value: MovementFilterValue;
  onChange: (value: MovementFilterValue) => void;
}

export function MovementFilter({ value, onChange }: MovementFilterProps) {
  const t = useTranslations("home.movements.filter");

  const options = [
    { value: MOVEMENT_FILTER.ALL, label: t("all") },
    { value: MOVEMENT_FILTER.DEBIT, label: t("debit") },
    { value: MOVEMENT_FILTER.CREDIT, label: t("credit") },
  ];

  return (
    <Segmented label={t("label")} name="movement-filter" options={options} value={value} onChange={onChange} />
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("transfers.metaTitles");

  return { title: t("recipient") };
}

export default function TransferRecipientPage() {
  return null;
}

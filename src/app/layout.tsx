import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { locale } from "@/shared/i18n/config";
import { montserrat, openSans } from "@/shared/styles/fonts";
import "./globals.css";

const INTERACTIVE_WIDGET = {
  RESIZES_CONTENT: "resizes-content",
} as const;

export const viewport: Viewport = {
  interactiveWidget: INTERACTIVE_WIDGET.RESIZES_CONTENT,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  const appName = t("appName");

  return {
    title: {
      template: `%s · ${appName}`,
      default: appName,
    },
    description: t("metadata.description"),
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={locale}
      className={`${montserrat.variable} ${openSans.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

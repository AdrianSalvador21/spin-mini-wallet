import type messages from "@/messages/es-MX";
import type { locale } from "./config";

declare module "next-intl" {
  interface AppConfig {
    Locale: typeof locale;
    Messages: typeof messages;
  }
}

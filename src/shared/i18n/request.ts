import { getRequestConfig } from "next-intl/server";
import messages from "@/messages/es-MX";
import { locale, timeZone } from "./config";

export default getRequestConfig(async () => ({
  locale,
  timeZone,
  messages,
}));

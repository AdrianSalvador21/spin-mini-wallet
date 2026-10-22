import { getHttpDependencies } from "@/server/container";
import { createWalletSummaryHandler } from "@/server/http/handlers/wallet-summary-handler";

export const GET = createWalletSummaryHandler(getHttpDependencies());

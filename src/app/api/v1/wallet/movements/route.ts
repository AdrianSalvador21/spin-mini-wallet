import { getHttpDependencies } from "@/server/container";
import { createWalletMovementsHandler } from "@/server/http/handlers/wallet-movements-handler";

export const GET = createWalletMovementsHandler(getHttpDependencies());

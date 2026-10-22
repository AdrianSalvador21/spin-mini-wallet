import { getHttpDependencies } from "@/server/container";
import { createGetTransferHandler } from "@/server/http/handlers/get-transfer-handler";

export const GET = createGetTransferHandler(getHttpDependencies());

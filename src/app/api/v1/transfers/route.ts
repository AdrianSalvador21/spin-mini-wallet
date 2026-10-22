import { getHttpDependencies } from "@/server/container";
import { createCreateTransferHandler } from "@/server/http/handlers/create-transfer-handler";
import { createFindTransferByKeyHandler } from "@/server/http/handlers/find-transfer-by-key-handler";

export const POST = createCreateTransferHandler(getHttpDependencies());
export const GET = createFindTransferByKeyHandler(getHttpDependencies());

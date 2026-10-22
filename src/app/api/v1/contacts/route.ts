import { getHttpDependencies } from "@/server/container";
import { createCreateContactHandler } from "@/server/http/handlers/create-contact-handler";
import { createListContactsHandler } from "@/server/http/handlers/list-contacts-handler";

export const GET = createListContactsHandler(getHttpDependencies());
export const POST = createCreateContactHandler(getHttpDependencies());

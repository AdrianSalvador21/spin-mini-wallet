import "server-only";
import { READ_RESOURCE } from "@/shared/lib/api/contract";
import { json } from "../json";
import { createRouteHandler, type HttpDependencies } from "../route-handler";
import { runWithReadScenario } from "./read-scenario";

export function createListContactsHandler(deps: HttpDependencies) {
  return createRouteHandler(deps, {}, (ctx) =>
    runWithReadScenario(ctx, deps, READ_RESOURCE.CONTACTS, async () => {
      const items = await deps.services.contact.listFavorites(ctx.session.userId);

      return json({ items }, 200);
    }),
  );
}

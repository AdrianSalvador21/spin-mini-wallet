import { http, HttpResponse, type HttpHandler } from "msw";
import type { MovementView } from "@/shared/lib/api/views";
import { buildMovement, buildWalletSummary } from "../factories/wallet";

const DEFAULT_LIMIT = 10;
const MOVEMENT_POOL_SIZE = 12;
const MOVEMENT_CYCLE: Array<{ type: MovementView["type"]; direction: MovementView["direction"] }> = [
  { type: "transfer_out", direction: "debit" },
  { type: "transfer_in", direction: "credit" },
  { type: "cash_deposit", direction: "credit" },
  { type: "qr_payment", direction: "debit" },
];

function buildMovementPool(): MovementView[] {
  return Array.from({ length: MOVEMENT_POOL_SIZE }, (_, index) => {
    const { type, direction } = MOVEMENT_CYCLE[index % MOVEMENT_CYCLE.length];

    return buildMovement({
      id: `mov_${index}` as MovementView["id"],
      type,
      direction,
      createdAt: new Date(Date.now() - index * 60_000).toISOString(),
    });
  });
}

export const handlers: HttpHandler[] = [
  http.get("/api/v1/wallet/summary", () => HttpResponse.json(buildWalletSummary())),
  http.get("/api/v1/wallet/movements", ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get("direction");
    const cursor = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT;

    const pool = buildMovementPool().filter((movement) => !direction || movement.direction === direction);
    const startIndex = cursor ? Number(cursor) : 0;
    const page = pool.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < pool.length;

    return HttpResponse.json({ items: page, nextCursor: hasMore ? String(startIndex + limit) : null });
  }),
];

import { http, HttpResponse, type HttpHandler } from "msw";
import { detectBank } from "@/domain/contact/banks";
import { maskAccount } from "@/domain/contact/mask";
import { RECIPIENT_ACCOUNT_TYPE, type RecipientAccount } from "@/domain/contact/types";
import { API_ERROR_CODE, type ApiErrorBody } from "@/shared/lib/api/contract";
import type { ContactView, MovementView } from "@/shared/lib/api/views";
import { buildContact, buildFavoriteContacts, MARIANA_PHONE } from "../factories/contacts";
import { buildTransfer } from "../factories/transfers";
import { buildMovement, buildWalletSummary } from "../factories/wallet";

const CARLOS_PHONE = "5523456789";

interface NewContactBody {
  name: string;
  account: RecipientAccount;
  saveAsFavorite: boolean;
}

function isPhone(account: RecipientAccount, phone: string): boolean {
  return account.type === RECIPIENT_ACCOUNT_TYPE.PHONE && account.phone.replace(/\D/g, "") === phone;
}

function toMockContactView({ name, account, saveAsFavorite }: NewContactBody): ContactView {
  const bankName = account.type === RECIPIENT_ACCOUNT_TYPE.CLABE ? detectBank(account.clabe) : undefined;

  return {
    id: "ctc_new" as ContactView["id"],
    name,
    account: { type: account.type, masked: maskAccount(account), ...(bankName ? { bankName } : {}) },
    isFavorite: saveAsFavorite,
  };
}

const RECIPIENT_IS_SELF_BODY: ApiErrorBody = {
  error: {
    code: API_ERROR_CODE.VALIDATION_ERROR,
    message: `errors.api.${API_ERROR_CODE.VALIDATION_ERROR}`,
    requestId: "req-msw-self",
    details: { account: ["RECIPIENT_IS_SELF"] },
  },
};

const TRANSFER_NOT_FOUND_BODY: ApiErrorBody = {
  error: {
    code: API_ERROR_CODE.NOT_FOUND,
    message: `errors.api.${API_ERROR_CODE.NOT_FOUND}`,
    requestId: "req-msw-lookup",
  },
};

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
  http.get("/api/v1/contacts", () => HttpResponse.json({ items: buildFavoriteContacts() })),
  http.post("/api/v1/contacts", async ({ request }) => {
    const body = (await request.json()) as NewContactBody;

    if (isPhone(body.account, MARIANA_PHONE)) {
      return HttpResponse.json(RECIPIENT_IS_SELF_BODY, { status: 400 });
    }

    if (isPhone(body.account, CARLOS_PHONE)) {
      return HttpResponse.json(buildContact(), { status: 200 });
    }

    return HttpResponse.json(toMockContactView(body), { status: 201 });
  }),
  http.post("/api/v1/transfers", () => HttpResponse.json(buildTransfer(), { status: 201 })),
  http.get("/api/v1/transfers", () => HttpResponse.json(TRANSFER_NOT_FOUND_BODY, { status: 404 })),
];

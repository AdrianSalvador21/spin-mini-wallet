import "server-only";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { RECIPIENT_ACCOUNT_TYPE, type ContactId } from "@/domain/contact/types";
import { addMoney, subtractMoney, toMoney, type Cents } from "@/domain/money/money";
import { err, ok, type Result } from "@/domain/shared/result";
import type { ValidationCode } from "@/domain/shared/validation-codes";
import { validateTransfer } from "@/domain/transfer/rules";
import type { createTransferSchema } from "@/domain/transfer/schemas";
import { TRANSFER_RECIPIENT_KIND, type Transfer, type TransferId } from "@/domain/transfer/types";
import type { UserId } from "@/domain/user/types";
import { MOVEMENT_DIRECTION, MOVEMENT_TYPE, type MovementId } from "@/domain/wallet/types";
import { accountsMatch } from "./account-match";
import { SERVICE_ERROR_CODE, type ServiceDependencies, type ServiceError } from "./types";
import { toTransferView, type TransferView } from "./views";

export interface TransferService {
  create(
    userId: UserId,
    input: z.infer<typeof createTransferSchema>,
    idempotencyKey: string,
  ): Promise<Result<TransferView, ServiceError>>;
  getById(userId: UserId, transferId: TransferId): Promise<Result<TransferView, ServiceError>>;
  findByIdempotencyKey(userId: UserId, key: string): Promise<Result<TransferView, ServiceError>>;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));

    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashPayload(input: unknown): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

function randomDigits(random: () => number, length: number): string {
  return Array.from({ length }, () => Math.floor(random() * 10).toString()).join("");
}

function buildFolio(random: () => number): string {
  return `SPN-${randomDigits(random, 8)}`;
}

function buildTrackingKey(random: () => number, now: Date): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  return `SPIN${yy}${mm}${dd}${randomDigits(random, 8)}`;
}

export function createTransferService({ db, now, random, createId }: ServiceDependencies): TransferService {
  return {
    async create(userId, input, idempotencyKey) {
      return db.transaction((repositories) => {
        const payloadHash = hashPayload(input);
        const existingRecord = repositories.idempotency.find(userId, idempotencyKey);

        if (existingRecord) {
          if (existingRecord.payloadHash !== payloadHash) {
            return err({ code: SERVICE_ERROR_CODE.IDEMPOTENCY_CONFLICT });
          }

          const storedTransfer = repositories.transfers.findById(existingRecord.transferId);

          if (storedTransfer) {
            return ok(toTransferView(storedTransfer));
          }
        }

        let recipient: Transfer["recipient"];

        if (input.recipient.kind === TRANSFER_RECIPIENT_KIND.CONTACT) {
          const contact = repositories.contacts.findById(input.recipient.contactId as ContactId);

          if (!contact || contact.ownerId !== userId) {
            return err({ code: SERVICE_ERROR_CODE.NOT_FOUND });
          }

          recipient = { name: contact.name, account: contact.account };
        } else {
          recipient = { name: input.recipient.name, account: input.recipient.account };
        }

        const sender = repositories.users.findById(userId);
        const wallet = repositories.wallets.findByUserId(userId);

        if (!sender || !wallet) {
          return err({ code: SERVICE_ERROR_CODE.NOT_FOUND });
        }

        if (recipient.account.type === RECIPIENT_ACCOUNT_TYPE.PHONE && recipient.account.phone === sender.phone) {
          return err({
            code: SERVICE_ERROR_CODE.VALIDATION_ERROR,
            details: { recipient: ["RECIPIENT_IS_SELF"] },
          });
        }

        const amount = toMoney(input.amountInCents as Cents);
        const validation = validateTransfer({ amount, recipient: input.recipient }, wallet.balance);

        if (!validation.ok) {
          if (validation.error.includes("INSUFFICIENT_FUNDS")) {
            return err({ code: SERVICE_ERROR_CODE.INSUFFICIENT_FUNDS, balance: wallet.balance });
          }

          const details: Record<string, ValidationCode[]> = {};

          if (validation.error.includes("AMOUNT_NOT_POSITIVE")) {
            details.amountInCents = ["AMOUNT_NOT_POSITIVE"];
          }

          if (validation.error.includes("RECIPIENT_REQUIRED")) {
            details.recipient = ["RECIPIENT_REQUIRED"];
          }

          return err({ code: SERVICE_ERROR_CODE.VALIDATION_ERROR, details });
        }

        wallet.balance = subtractMoney(wallet.balance, amount);
        wallet.updatedAt = now().toISOString();

        const transferId = `trf_${createId()}` as TransferId;

        repositories.movements.insert({
          id: `mov_${createId()}` as MovementId,
          userId,
          type: MOVEMENT_TYPE.TRANSFER_OUT,
          direction: MOVEMENT_DIRECTION.DEBIT,
          amount,
          counterpartyName: recipient.name,
          transferId,
          createdAt: now().toISOString(),
        });

        if (recipient.account.type === RECIPIENT_ACCOUNT_TYPE.PHONE) {
          const recipientUser = repositories.users.findByPhone(recipient.account.phone);
          const recipientWallet = recipientUser && repositories.wallets.findByUserId(recipientUser.id);

          if (recipientUser && recipientWallet) {
            recipientWallet.balance = addMoney(recipientWallet.balance, amount);
            recipientWallet.updatedAt = now().toISOString();

            repositories.movements.insert({
              id: `mov_${createId()}` as MovementId,
              userId: recipientUser.id,
              type: MOVEMENT_TYPE.TRANSFER_IN,
              direction: MOVEMENT_DIRECTION.CREDIT,
              amount,
              counterpartyName: sender.fullName,
              transferId,
              createdAt: now().toISOString(),
            });
          }
        }

        const recipientInput = input.recipient;

        if (recipientInput.kind === TRANSFER_RECIPIENT_KIND.NEW && recipientInput.saveAsFavorite) {
          const existingContact = repositories.contacts
            .listByOwnerId(userId)
            .find((contact) => accountsMatch(contact.account, recipientInput.account));

          if (!existingContact) {
            repositories.contacts.insert({
              id: `ctc_${createId()}` as ContactId,
              ownerId: userId,
              name: recipientInput.name,
              account: recipientInput.account,
              isFavorite: true,
              createdAt: now().toISOString(),
            });
          }
        }

        const transfer: Transfer = {
          id: transferId,
          folio: buildFolio(random),
          trackingKey: buildTrackingKey(random, now()),
          senderId: userId,
          recipient,
          amount,
          concept: input.concept,
          status: "completed",
          idempotencyKey,
          createdAt: now().toISOString(),
        };

        repositories.transfers.insert(transfer);
        repositories.idempotency.insert({
          key: idempotencyKey,
          userId,
          payloadHash,
          transferId,
          createdAt: now().toISOString(),
        });

        return ok(toTransferView(transfer));
      });
    },

    async getById(userId, transferId) {
      const transfer = await db.read((repositories) => repositories.transfers.findById(transferId));

      if (!transfer || transfer.senderId !== userId) {
        return err({ code: SERVICE_ERROR_CODE.NOT_FOUND });
      }

      return ok(toTransferView(transfer));
    },

    async findByIdempotencyKey(userId, key) {
      const record = await db.read((repositories) => repositories.idempotency.find(userId, key));

      if (!record) {
        return err({ code: SERVICE_ERROR_CODE.NOT_FOUND });
      }

      const transfer = await db.read((repositories) => repositories.transfers.findById(record.transferId));

      if (!transfer) {
        return err({ code: SERVICE_ERROR_CODE.NOT_FOUND });
      }

      return ok(toTransferView(transfer));
    },
  };
}

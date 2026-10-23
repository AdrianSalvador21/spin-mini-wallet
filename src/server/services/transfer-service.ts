import "server-only";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { RECIPIENT_ACCOUNT_TYPE } from "@/domain/contact/types";
import { addMoney, subtractMoney, toMoney, type Money } from "@/domain/money/money";
import { err, ok, type Result } from "@/domain/shared/result";
import type { ValidationCode } from "@/domain/shared/validation-codes";
import { TRANSFER_RULE_VIOLATION, validateTransfer, type TransferRuleViolation } from "@/domain/transfer/rules";
import type { createTransferSchema } from "@/domain/transfer/schemas";
import { TRANSFER_STATUS, type Transfer, type TransferId } from "@/domain/transfer/types";
import type { User, UserId } from "@/domain/user/types";
import { MOVEMENT_DIRECTION, MOVEMENT_TYPE, type MovementId, type Wallet } from "@/domain/wallet/types";
import type { Repositories } from "../repositories";
import { SERVICE_ERROR_CODE, type ServiceDependencies, type ServiceError } from "./types";
import { toTransferView, type TransferView } from "./views";

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export interface TransferService {
  check(userId: UserId, input: CreateTransferInput): Promise<Result<void, ServiceError>>;
  create(userId: UserId, input: CreateTransferInput, idempotencyKey: string): Promise<Result<TransferView, ServiceError>>;
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

interface CheckedTransfer {
  sender: User;
  wallet: Wallet;
  recipient: Transfer["recipient"];
  amount: Money;
}

function toRuleError(violations: TransferRuleViolation[], balance: Money): ServiceError {
  if (violations.includes(TRANSFER_RULE_VIOLATION.INSUFFICIENT_FUNDS)) {
    return { code: SERVICE_ERROR_CODE.INSUFFICIENT_FUNDS, balance };
  }

  const details: Record<string, ValidationCode[]> = {};

  if (violations.includes(TRANSFER_RULE_VIOLATION.AMOUNT_NOT_POSITIVE)) {
    details.amountInCents = [TRANSFER_RULE_VIOLATION.AMOUNT_NOT_POSITIVE];
  }

  if (violations.includes(TRANSFER_RULE_VIOLATION.RECIPIENT_REQUIRED)) {
    details.recipient = [TRANSFER_RULE_VIOLATION.RECIPIENT_REQUIRED];
  }

  return { code: SERVICE_ERROR_CODE.VALIDATION_ERROR, details };
}

function checkTransfer(
  repositories: Repositories,
  userId: UserId,
  input: CreateTransferInput,
): Result<CheckedTransfer, ServiceError> {
  const contact = repositories.contacts.findById(input.recipient.contactId);

  if (!contact || contact.ownerId !== userId) {
    return err({ code: SERVICE_ERROR_CODE.NOT_FOUND });
  }

  const sender = repositories.users.findById(userId);
  const wallet = repositories.wallets.findByUserId(userId);

  if (!sender || !wallet) {
    return err({ code: SERVICE_ERROR_CODE.NOT_FOUND });
  }

  if (contact.account.type === RECIPIENT_ACCOUNT_TYPE.PHONE && contact.account.phone === sender.phone) {
    return err({ code: SERVICE_ERROR_CODE.VALIDATION_ERROR, details: { recipient: ["RECIPIENT_IS_SELF"] } });
  }

  const amount = toMoney(input.amountInCents);
  const validation = validateTransfer({ amount, recipient: input.recipient }, wallet.balance);

  if (!validation.ok) {
    return err(toRuleError(validation.error, wallet.balance));
  }

  return ok({ sender, wallet, recipient: { name: contact.name, account: contact.account }, amount });
}

export function createTransferService({ db, now, random, createId }: ServiceDependencies): TransferService {
  return {
    async check(userId, input) {
      const checked = await db.read((repositories) => checkTransfer(repositories, userId, input));

      return checked.ok ? ok(undefined) : checked;
    },

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

        const checked = checkTransfer(repositories, userId, input);

        if (!checked.ok) {
          return checked;
        }

        const { sender, wallet, recipient, amount } = checked.value;

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
          counterpartyAccount: recipient.account,
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
              counterpartyAccount: { type: RECIPIENT_ACCOUNT_TYPE.PHONE, phone: sender.phone },
              transferId,
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
          status: TRANSFER_STATUS.COMPLETED,
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

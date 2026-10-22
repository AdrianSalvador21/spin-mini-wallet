import "server-only";
import { detectBank } from "@/domain/contact/banks";
import { maskAccount } from "@/domain/contact/mask";
import { RECIPIENT_ACCOUNT_TYPE, type Contact, type RecipientAccount } from "@/domain/contact/types";
import type { Transfer } from "@/domain/transfer/types";
import type { User } from "@/domain/user/types";
import type { Movement } from "@/domain/wallet/types";
import type { AccountView, MovementsPage, MovementView, WalletSummary } from "@/shared/lib/api/views";

export type { AccountView, MovementsPage, MovementView, WalletSummary };

export interface UserView {
  id: User["id"];
  fullName: string;
  phone: string;
  email: string;
}

export interface ContactView {
  id: Contact["id"];
  name: string;
  account: AccountView;
  isFavorite: boolean;
}

export interface TransferView {
  id: Transfer["id"];
  folio: string;
  trackingKey: string;
  recipient: { name: string; account: AccountView };
  amount: Transfer["amount"];
  concept?: string;
  status: Transfer["status"];
  createdAt: string;
}

export function toUserView(user: User): UserView {
  return { id: user.id, fullName: user.fullName, phone: user.phone, email: user.email };
}

export function toAccountView(account: RecipientAccount): AccountView {
  const masked = maskAccount(account);

  if (account.type === RECIPIENT_ACCOUNT_TYPE.CLABE) {
    const bankName = detectBank(account.clabe);

    return bankName ? { type: account.type, masked, bankName } : { type: account.type, masked };
  }

  return { type: account.type, masked };
}

export function toContactView(contact: Contact): ContactView {
  return {
    id: contact.id,
    name: contact.name,
    account: toAccountView(contact.account),
    isFavorite: contact.isFavorite,
  };
}

export function toMovementView(movement: Movement): MovementView {
  return {
    id: movement.id,
    type: movement.type,
    direction: movement.direction,
    amount: movement.amount,
    counterpartyName: movement.counterpartyName,
    merchantName: movement.merchantName,
    counterpartyAccount: movement.counterpartyAccount ? toAccountView(movement.counterpartyAccount) : undefined,
    transferId: movement.transferId,
    createdAt: movement.createdAt,
  };
}

export function toTransferView(transfer: Transfer): TransferView {
  return {
    id: transfer.id,
    folio: transfer.folio,
    trackingKey: transfer.trackingKey,
    recipient: {
      name: transfer.recipient.name,
      account: toAccountView(transfer.recipient.account),
    },
    amount: transfer.amount,
    concept: transfer.concept,
    status: transfer.status,
    createdAt: transfer.createdAt,
  };
}

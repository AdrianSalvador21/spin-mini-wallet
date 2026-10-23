import { notFound, redirect } from "next/navigation";
import type { TransferId } from "@/domain/transfer/types";
import { TransferReceipt } from "@/features/transfers/components/transfer-receipt/transfer-receipt";
import { getServices } from "@/server/container";
import { getSession } from "@/server/session/session";
import { ROUTES } from "@/shared/lib/routes";

interface ReceiptSectionProps {
  params: Promise<{ transferId: string }>;
}

export async function ReceiptSection({ params }: ReceiptSectionProps) {
  const { transferId } = await params;
  const session = await getSession();

  if (!session) {
    redirect(ROUTES.LOGIN);
  }

  const result = await getServices().transfer.getById(session.userId, transferId as TransferId);

  if (!result.ok) {
    notFound();
  }

  return <TransferReceipt transfer={result.value} />;
}

import { ReceiptNotFound } from "@/features/transfers/components/receipt-not-found/receipt-not-found";

export default function TransferReceiptNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-focus flex-1 flex-col lg:flex-none lg:py-8">
      <ReceiptNotFound />
    </div>
  );
}

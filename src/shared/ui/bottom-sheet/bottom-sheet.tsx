"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import styles from "./bottom-sheet.module.scss";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, label, closeLabel, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      className={styles["bottom-sheet"]}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className={styles["bottom-sheet__panel"]} onClick={(event) => event.stopPropagation()}>
        <span className={styles["bottom-sheet__handle"]} aria-hidden="true" />
        {children}
        <button type={BUTTON_TYPE.BUTTON} className={styles["bottom-sheet__close"]} onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </dialog>
  );
}

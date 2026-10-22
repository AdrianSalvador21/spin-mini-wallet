"use client";

import { useCallback, useLayoutEffect, useRef, type ChangeEvent, type ReactNode, type Ref } from "react";
import { formatAmountInput, sanitizeAmountInput } from "@/shared/lib/format/amount-input";
import { AUTO_COMPLETE, INPUT_MODE, INPUT_TYPE } from "@/shared/ui/field/types";
import styles from "./amount-input.module.scss";
import { CURRENCY_SYMBOL, EMPTY_AMOUNT_PLACEHOLDER } from "./types";

interface AmountInputProps {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  hint?: ReactNode;
  error?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

function describedBy(errorId: string | undefined, hintId: string | undefined): string | undefined {
  return errorId ?? hintId;
}

export function AmountInput({ id, label, value, onChange, onBlur, name, hint, error, ref }: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretFromEnd = useRef<number | null>(null);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = Boolean(error);

  const setRefs = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      assignRef(ref, element);
    },
    [ref],
  );

  useLayoutEffect(() => {
    const input = inputRef.current;

    if (!input || caretFromEnd.current === null) {
      return;
    }

    const position = Math.max(0, input.value.length - caretFromEnd.current);
    input.setSelectionRange(position, position);
    caretFromEnd.current = null;
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const fromEnd = input.value.length - (input.selectionEnd ?? input.value.length);
    const sanitized = sanitizeAmountInput(input.value);

    if (sanitized === null) {
      const position = Math.max(0, value.length - fromEnd);
      input.value = value;
      input.setSelectionRange(position, position);
      return;
    }

    caretFromEnd.current = fromEnd;
    onChange(formatAmountInput(sanitized));
  }

  return (
    <div className={styles["amount-input"]}>
      <label htmlFor={id} className={styles["amount-input__label"]}>
        {label}
      </label>
      <div className={[styles["amount-input__control"], hasError && styles["amount-input__control--error"]].filter(Boolean).join(" ")}>
        <span className={styles["amount-input__symbol"]} aria-hidden="true">
          {CURRENCY_SYMBOL}
        </span>
        <input
          ref={setRefs}
          id={id}
          name={name}
          type={INPUT_TYPE.TEXT}
          inputMode={INPUT_MODE.DECIMAL}
          autoComplete={AUTO_COMPLETE.OFF}
          value={value}
          placeholder={EMPTY_AMOUNT_PLACEHOLDER}
          size={Math.max(value.length, 1)}
          onChange={handleChange}
          onBlur={onBlur}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy(hasError ? errorId : undefined, hint ? hintId : undefined)}
          className={styles["amount-input__field"]}
        />
      </div>
      {hasError ? (
        <p id={errorId} className={styles["amount-input__error"]}>
          {error}
        </p>
      ) : null}
      {hint ? (
        <div id={hintId} className={styles["amount-input__hint"]}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

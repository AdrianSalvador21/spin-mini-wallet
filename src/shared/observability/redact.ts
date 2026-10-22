const REDACTED_VALUE = "[REDACTED]";
const CIRCULAR_VALUE = "[CIRCULAR]";

const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "phone",
  "email",
  "clabe",
  "cardnumber",
]);

export function redact(value: unknown): unknown {
  return redactValue(value, new Set());
}

function redactValue(value: unknown, seen: Set<unknown>): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return CIRCULAR_VALUE;
  }

  seen.add(value);

  const result = Array.isArray(value)
    ? value.map((item) => redactValue(item, seen))
    : redactObject(value as Record<string, unknown>, seen);

  seen.delete(value);

  return result;
}

function redactObject(value: Record<string, unknown>, seen: Set<unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    result[key] = REDACTED_KEYS.has(key.toLowerCase())
      ? REDACTED_VALUE
      : redactValue(entryValue, seen);
  }

  return result;
}

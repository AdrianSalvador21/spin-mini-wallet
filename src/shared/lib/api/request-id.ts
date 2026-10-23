const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRequestId(value: string | null): value is string {
  return value !== null && REQUEST_ID_PATTERN.test(value);
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

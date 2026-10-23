export interface SecurityHeader {
  key: string;
  value: string;
}

export const SECURITY_HEADER = {
  CONTENT_TYPE_OPTIONS: "X-Content-Type-Options",
  REFERRER_POLICY: "Referrer-Policy",
  FRAME_OPTIONS: "X-Frame-Options",
  PERMISSIONS_POLICY: "Permissions-Policy",
  STRICT_TRANSPORT_SECURITY: "Strict-Transport-Security",
} as const;

const BASE_HEADERS: readonly SecurityHeader[] = [
  { key: SECURITY_HEADER.CONTENT_TYPE_OPTIONS, value: "nosniff" },
  { key: SECURITY_HEADER.REFERRER_POLICY, value: "strict-origin-when-cross-origin" },
  { key: SECURITY_HEADER.FRAME_OPTIONS, value: "DENY" },
  { key: SECURITY_HEADER.PERMISSIONS_POLICY, value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const HSTS_HEADER: SecurityHeader = {
  key: SECURITY_HEADER.STRICT_TRANSPORT_SECURITY,
  value: "max-age=63072000; includeSubDomains",
};

export function securityHeaders(isProduction: boolean): SecurityHeader[] {
  return isProduction ? [...BASE_HEADERS, HSTS_HEADER] : [...BASE_HEADERS];
}

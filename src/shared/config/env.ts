import { z } from "zod";

const booleanFlag = (defaultValue: boolean) =>
  z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value === "true"));

const envSchema = z.object({
  SESSION_SECRET: z.string().min(32),
  MOCK_DB_PATH: z.string().min(1).default(".data/db.json"),
  MOCK_ALLOW_SCENARIO_OVERRIDE: booleanFlag(false),
  NEXT_PUBLIC_ENABLE_DEV_TOOLS: booleanFlag(false),
});

export type Env = z.infer<typeof envSchema>;

export const NODE_ENV = {
  PRODUCTION: "production",
} as const;

export function isProduction(): boolean {
  return process.env.NODE_ENV === NODE_ENV.PRODUCTION;
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment variables: ${issues}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    setupFiles: [path.resolve(dirname, "src/test/setup.ts")],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/server/**", "src/shared/lib/**", "src/shared/observability/**"],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80,
        "src/domain/**": {
          lines: 100,
          statements: 100,
          branches: 100,
          functions: 100,
        },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "**/.git/**", "src/server/**", "src/proxy.test.ts"],
        },
      },
      {
        extends: true,
        resolve: {
          alias: {
            "server-only": path.resolve(dirname, "node_modules/server-only/empty.js"),
          },
        },
        test: {
          name: "node",
          environment: "node",
          setupFiles: [path.resolve(dirname, "src/test/server-setup.ts")],
          include: ["src/server/**/*.test.{ts,tsx}", "src/proxy.test.ts"],
        },
      },
    ],
  },
});

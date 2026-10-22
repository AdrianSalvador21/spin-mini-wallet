import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { getEnv, isProduction } from "./src/shared/config/env";
import { securityHeaders } from "./src/shared/config/security-headers";

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

getEnv();

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(isProduction()) }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);

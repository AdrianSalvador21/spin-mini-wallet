import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { getEnv } from "./src/shared/config/env";

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

getEnv();

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
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

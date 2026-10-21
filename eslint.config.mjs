import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const FEATURES = ["auth", "wallet", "transfers"];

const frameworkImports = {
  group: ["react", "react/**", "react-dom", "react-dom/**", "next", "next/**", "next-intl", "next-intl/**"],
  message: "The domain layer must stay framework-free.",
};

const serverImports = {
  group: ["@/server", "@/server/**"],
  message: "Only server actions and route handlers may import the server layer.",
};

const featureImports = {
  group: ["@/features", "@/features/**"],
  message: "This layer must not depend on features.",
};

const sharedUiImports = {
  group: ["@/shared/ui", "@/shared/ui/**"],
  message: "This layer must not depend on UI components.",
};

const otherFeatureImports = (feature) => ({
  group: FEATURES.filter((other) => other !== feature).flatMap((other) => [
    `@/features/${other}`,
    `@/features/${other}/**`,
  ]),
  message: "Features must not import from other features. Move shared code to src/shared.",
});

const restrictImports = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const architectureRules = [
  {
    files: ["src/domain/**"],
    rules: restrictImports(frameworkImports, serverImports, featureImports, sharedUiImports),
  },
  {
    files: ["src/server/**"],
    rules: restrictImports(featureImports, sharedUiImports),
  },
  ...FEATURES.flatMap((feature) => [
    {
      files: [`src/features/${feature}/**`],
      rules: restrictImports(otherFeatureImports(feature)),
    },
    {
      files: [`src/features/${feature}/components/**`, `src/features/${feature}/hooks/**`],
      rules: restrictImports(otherFeatureImports(feature), serverImports),
    },
  ]),
  {
    files: ["src/**"],
    rules: { "no-console": "error" },
  },
  {
    files: ["src/shared/observability/**"],
    rules: { "no-console": "off" },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...architectureRules,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;

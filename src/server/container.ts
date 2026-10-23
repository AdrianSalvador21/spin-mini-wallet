import "server-only";
import { randomUUID } from "node:crypto";
import { getEnv } from "@/shared/config/env";
import { getErrorReporter } from "@/shared/observability/error-reporter";
import { logger } from "@/shared/observability/logger";
import { createAuthActions, type AuthActions } from "./auth/auth-actions";
import { getLoginRateLimiter } from "./auth/login-rate-limiter";
import { createJsonDatabase } from "./db/json-database";
import { createSeed } from "./db/seed";
import type { HttpDependencies } from "./http/route-handler";
import { createAuthService, type AuthService } from "./services/auth-service";
import { createContactService, type ContactService } from "./services/contact-service";
import { createTransferService, type TransferService } from "./services/transfer-service";
import type { ServiceDependencies } from "./services/types";
import { createWalletService, type WalletService } from "./services/wallet-service";
import { createHomeLoader, type HomeLoader } from "./wallet/home-loader";

export interface Services {
  auth: AuthService;
  wallet: WalletService;
  contact: ContactService;
  transfer: TransferService;
}

let cachedServices: Services | undefined;

function createServices(): Services {
  const deps: ServiceDependencies = {
    db: createJsonDatabase(getEnv().MOCK_DB_PATH, () => createSeed(new Date())),
    now: () => new Date(),
    random: () => Math.random(),
    createId: () => randomUUID(),
  };

  return {
    auth: createAuthService(deps),
    wallet: createWalletService(deps),
    contact: createContactService(deps),
    transfer: createTransferService(deps),
  };
}

export function getServices(): Services {
  if (!cachedServices) {
    cachedServices = createServices();
  }

  return cachedServices;
}

let cachedHttpDependencies: HttpDependencies | undefined;

export function getHttpDependencies(): HttpDependencies {
  if (!cachedHttpDependencies) {
    cachedHttpDependencies = {
      services: getServices(),
      random: () => Math.random(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      createRequestId: () => randomUUID(),
      logger,
      reporter: getErrorReporter(),
      allowScenarioOverride: getEnv().MOCK_ALLOW_SCENARIO_OVERRIDE,
    };
  }

  return cachedHttpDependencies;
}

let cachedHomeLoader: HomeLoader | undefined;

export function getHomeLoader(): HomeLoader {
  if (!cachedHomeLoader) {
    cachedHomeLoader = createHomeLoader({
      services: getServices(),
      random: () => Math.random(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      logger,
      allowScenarioOverride: getEnv().MOCK_ALLOW_SCENARIO_OVERRIDE,
    });
  }

  return cachedHomeLoader;
}

let cachedAuthActions: AuthActions | undefined;

export function getAuthActions(): AuthActions {
  if (!cachedAuthActions) {
    cachedAuthActions = createAuthActions({
      auth: getServices().auth,
      rateLimiter: getLoginRateLimiter(),
      logger,
      reporter: getErrorReporter(),
    });
  }

  return cachedAuthActions;
}

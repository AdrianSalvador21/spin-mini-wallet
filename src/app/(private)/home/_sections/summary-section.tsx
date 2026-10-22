import { randomUUID } from "node:crypto";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/features/auth/components/logout-button/logout-button";
import { LOGOUT_BUTTON_VARIANT } from "@/features/auth/components/logout-button/types";
import { BalanceCard } from "@/features/wallet/components/balance-card/balance-card";
import { HomeHeader } from "@/features/wallet/components/home-header/home-header";
import { getHomeLoader } from "@/server/container";
import { getSession } from "@/server/session/session";
import { REQUEST_ID_HEADER, SCENARIO_COOKIE } from "@/shared/lib/api/contract";
import { walletQueryKeys } from "@/shared/lib/api/wallet-queries";
import { BALANCE_VISIBILITY_COOKIE, isBalanceHidden } from "@/shared/lib/preferences/balance-visibility";
import { ROUTES } from "@/shared/lib/routes";
import styles from "../page.module.scss";

export async function SummarySection() {
  const session = await getSession();

  if (!session) {
    redirect(ROUTES.LOGIN);
  }

  const [requestHeaders, requestCookies] = await Promise.all([headers(), cookies()]);
  const requestId = requestHeaders.get(REQUEST_ID_HEADER) ?? randomUUID();
  const scenarioCookie = requestCookies.get(SCENARIO_COOKIE.READ)?.value;
  const initialHidden = isBalanceHidden(requestCookies.get(BALANCE_VISIBILITY_COOKIE)?.value);
  const now = new Date().toISOString();

  const result = await getHomeLoader().loadSummary({ userId: session.userId, requestId, scenarioCookie });
  const queryClient = new QueryClient();

  if (result.ok) {
    queryClient.setQueryData(walletQueryKeys.summary(), result.value);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className={styles["home-page__header"]}>
        <HomeHeader now={now} logoutSlot={<LogoutButton variant={LOGOUT_BUTTON_VARIANT.MENU_ITEM} />} />
      </div>
      <div className={styles["home-page__aside"]}>
        <BalanceCard initialHidden={initialHidden} />
      </div>
    </HydrationBoundary>
  );
}

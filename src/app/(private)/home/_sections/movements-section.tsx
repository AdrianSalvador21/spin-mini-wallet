import { randomUUID } from "node:crypto";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { MovementList } from "@/features/wallet/components/movement-list/movement-list";
import { getHomeLoader } from "@/server/container";
import { getSession } from "@/server/session/session";
import { REQUEST_ID_HEADER, SCENARIO_COOKIE } from "@/shared/lib/api/contract";
import { MOVEMENT_FILTER, parseMovementFilter, walletQueryKeys } from "@/shared/lib/api/wallet-queries";
import { ROUTES } from "@/shared/lib/routes";
import styles from "../page.module.scss";

interface MovementsSectionProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function MovementsSection({ searchParams }: MovementsSectionProps) {
  const session = await getSession();

  if (!session) {
    redirect(ROUTES.LOGIN);
  }

  const resolvedSearchParams = await searchParams;
  const directionParam = resolvedSearchParams.direction;
  const directionValue = Array.isArray(directionParam) ? (directionParam[0] ?? null) : (directionParam ?? null);
  const filter = parseMovementFilter(directionValue);

  const [requestHeaders, requestCookies] = await Promise.all([headers(), cookies()]);
  const requestId = requestHeaders.get(REQUEST_ID_HEADER) ?? randomUUID();
  const scenarioCookie = requestCookies.get(SCENARIO_COOKIE.READ)?.value;
  const now = new Date().toISOString();

  const result = await getHomeLoader().loadMovements({
    userId: session.userId,
    requestId,
    scenarioCookie,
    direction: filter === MOVEMENT_FILTER.ALL ? undefined : filter,
  });
  const queryClient = new QueryClient();

  if (result.ok) {
    queryClient.setQueryData(walletQueryKeys.movements(filter), { pages: [result.value], pageParams: [null] });
  }

  return (
    <div className={styles["home-page__movements"]}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MovementList now={now} />
      </HydrationBoundary>
    </div>
  );
}

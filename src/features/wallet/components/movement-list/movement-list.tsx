"use client";

import { useTranslations } from "next-intl";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { MovementFilter as MovementFilterControl } from "@/features/wallet/components/movement-filter/movement-filter";
import { MovementRow, type Translator } from "@/features/wallet/components/movement-row/movement-row";
import { MovementsSkeleton } from "@/features/wallet/components/movements-skeleton/movements-skeleton";
import { MovementsState } from "@/features/wallet/components/movements-state/movements-state";
import { useMovementFilter } from "@/features/wallet/hooks/use-movement-filter";
import { useMovements } from "@/features/wallet/hooks/use-movements";
import { API_FAILURE_KIND, ApiFailureError } from "@/shared/lib/api/api-client";
import { MOVEMENT_FILTER, type MovementFilter } from "@/shared/lib/api/wallet-queries";
import { DATE_GROUP_KIND, formatMonthLabel, groupMovements, type DateGroup } from "@/shared/lib/format/date";
import { Alert } from "@/shared/ui/alert/alert";
import { ALERT_ROLE, ALERT_TONE } from "@/shared/ui/alert/types";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_VARIANT } from "@/shared/ui/button/types";
import { ICON_NAME } from "@/shared/ui/icon/types";
import styles from "./movement-list.module.scss";
import { MOVEMENTS_VIEW_KIND, type MovementsViewKind } from "./types";

const LOAD_MORE_SKELETON_ROWS = 3;

export function getMovementsViewKind(params: {
  isPending: boolean;
  isError: boolean;
  hasData: boolean;
  itemCount: number;
  filter: MovementFilter;
}): MovementsViewKind {
  if (params.isPending) {
    return MOVEMENTS_VIEW_KIND.LOADING;
  }

  if (params.isError && !params.hasData) {
    return MOVEMENTS_VIEW_KIND.ERROR;
  }

  if (params.itemCount === 0) {
    return params.filter === MOVEMENT_FILTER.ALL ? MOVEMENTS_VIEW_KIND.EMPTY : MOVEMENTS_VIEW_KIND.EMPTY_FILTERED;
  }

  return MOVEMENTS_VIEW_KIND.LIST;
}

export function getGroupKey(group: DateGroup): string {
  return group.kind === DATE_GROUP_KIND.MONTH ? `${group.kind}-${group.year}-${group.month}` : group.kind;
}

export function getGroupLabel(t: Translator, group: DateGroup, now: string): string {
  switch (group.kind) {
    case DATE_GROUP_KIND.TODAY:
      return t("groups.today");
    case DATE_GROUP_KIND.YESTERDAY:
      return t("groups.yesterday");
    case DATE_GROUP_KIND.THIS_WEEK:
      return t("groups.thisWeek");
    case DATE_GROUP_KIND.MONTH:
      return formatMonthLabel(group.year, group.month, now);
    default:
      return assertUnreachable(group);
  }
}

function requestIdOf(error: unknown): string | undefined {
  return error instanceof ApiFailureError && error.failure.kind === API_FAILURE_KIND.API
    ? error.failure.requestId
    : undefined;
}

interface MovementListProps {
  now: string;
}

export function MovementList({ now }: MovementListProps) {
  const t = useTranslations("home.movements") as Translator;
  const [filter, setFilter] = useMovementFilter();
  const {
    items,
    data,
    isPending,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useMovements(filter);

  const viewKind = getMovementsViewKind({
    isPending,
    isError,
    hasData: Boolean(data),
    itemCount: items.length,
    filter,
  });
  const groups = groupMovements(items, now);

  return (
    <section className={styles["movement-list"]}>
      <div className={styles["movement-list__header"]}>
        <h2 className={styles["movement-list__title"]}>{t("title")}</h2>
        <MovementFilterControl value={filter} onChange={setFilter} />
      </div>

      <div className={styles["movement-list__columns"]} aria-hidden="true">
        <span>{t("columns.concept")}</span>
        <span>{t("columns.date")}</span>
        <span>{t("columns.amount")}</span>
      </div>

      {(() => {
        switch (viewKind) {
          case MOVEMENTS_VIEW_KIND.LOADING:
            return <MovementsSkeleton />;
          case MOVEMENTS_VIEW_KIND.ERROR:
            return (
              <MovementsState
                icon={ICON_NAME.ALERT}
                title={t("error.title")}
                text={t("error.text")}
                actionLabel={t("error.retry")}
                onAction={() => refetch()}
                requestId={requestIdOf(error)}
              />
            );
          case MOVEMENTS_VIEW_KIND.EMPTY:
            return <MovementsState icon={ICON_NAME.INBOX} title={t("empty.title")} text={t("empty.text")} />;
          case MOVEMENTS_VIEW_KIND.EMPTY_FILTERED:
            return (
              <MovementsState
                icon={ICON_NAME.INBOX}
                title={t("emptyFiltered.title")}
                text={t("emptyFiltered.text")}
              />
            );
          case MOVEMENTS_VIEW_KIND.LIST:
            return (
              <>
                {groups.map(({ group, items: groupItems }) => (
                  <section
                    key={getGroupKey(group)}
                    className={styles["movement-list__group"]}
                    aria-label={getGroupLabel(t, group, now)}
                  >
                    <h3 className={styles["movement-list__group-heading"]}>{getGroupLabel(t, group, now)}</h3>
                    <ul className={styles["movement-list__rows"]}>
                      {groupItems.map((item) => (
                        <MovementRow key={item.id} movement={item} now={now} />
                      ))}
                    </ul>
                  </section>
                ))}

                {isFetchingNextPage && <MovementsSkeleton rows={LOAD_MORE_SKELETON_ROWS} />}

                {isFetchNextPageError && (
                  <div className={styles["movement-list__more-error"]}>
                    <Alert tone={ALERT_TONE.DANGER} role={ALERT_ROLE.ALERT}>
                      {t("moreError")}
                    </Alert>
                    <Button variant={BUTTON_VARIANT.SECONDARY} onClick={() => fetchNextPage()}>
                      {t("error.retry")}
                    </Button>
                  </div>
                )}

                {hasNextPage && (
                  <Button
                    variant={BUTTON_VARIANT.SECONDARY}
                    loading={isFetchingNextPage}
                    loadingLabel={t("loadingMore")}
                    onClick={() => fetchNextPage()}
                    className={styles["movement-list__more"]}
                  >
                    {t("more")}
                  </Button>
                )}
              </>
            );
          default:
            return assertUnreachable(viewKind);
        }
      })()}
    </section>
  );
}

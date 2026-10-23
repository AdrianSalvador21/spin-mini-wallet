import type { MovementView } from "@/shared/lib/api/views";
import { locale, timeZone } from "@/shared/i18n/config";

export const DATE_GROUP_KIND = {
  TODAY: "today",
  YESTERDAY: "yesterday",
  THIS_WEEK: "this_week",
  MONTH: "month",
} as const;

export type DateGroup =
  | { kind: typeof DATE_GROUP_KIND.TODAY }
  | { kind: typeof DATE_GROUP_KIND.YESTERDAY }
  | { kind: typeof DATE_GROUP_KIND.THIS_WEEK }
  | { kind: typeof DATE_GROUP_KIND.MONTH; year: number; month: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const THIS_WEEK_MAX_DAYS = 6;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function getZonedParts(iso: string): ZonedParts {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  return {
    year: Number(getPart(parts, "year")),
    month: Number(getPart(parts, "month")),
    day: Number(getPart(parts, "day")),
  };
}

export function getDateGroup(iso: string, nowIso: string): DateGroup {
  const moved = getZonedParts(iso);
  const now = getZonedParts(nowIso);
  const movedUtc = Date.UTC(moved.year, moved.month - 1, moved.day);
  const nowUtc = Date.UTC(now.year, now.month - 1, now.day);
  const dayDiff = Math.round((nowUtc - movedUtc) / DAY_MS);

  if (dayDiff === 0) {
    return { kind: DATE_GROUP_KIND.TODAY };
  }

  if (dayDiff === 1) {
    return { kind: DATE_GROUP_KIND.YESTERDAY };
  }

  if (dayDiff >= 2 && dayDiff <= THIS_WEEK_MAX_DAYS) {
    return { kind: DATE_GROUP_KIND.THIS_WEEK };
  }

  return { kind: DATE_GROUP_KIND.MONTH, year: moved.year, month: moved.month };
}

export function formatTime(iso: string): string {
  const date = new Date(iso);

  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    date,
  );
}

export function formatDayAndTime(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short" }).formatToParts(date);
  const day = getPart(parts, "day");
  const month = getPart(parts, "month");

  return `${day} ${month}, ${formatTime(iso)}`;
}

export function formatReceiptDate(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const day = getPart(parts, "day");
  const month = getPart(parts, "month").replace(".", "");
  const year = getPart(parts, "year");

  return `${day} ${month} ${year}, ${formatTime(iso)} h`;
}

export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  const withoutLeadingComma = formatted.replace(", ", " ");

  return withoutLeadingComma.charAt(0).toUpperCase() + withoutLeadingComma.slice(1);
}

export function formatMonthLabel(year: number, month: number, nowIso: string): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  const monthName = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long" }).format(date);
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const nowYear = getZonedParts(nowIso).year;

  return year === nowYear ? capitalized : `${capitalized} ${year}`;
}

function sameGroup(a: DateGroup, b: DateGroup): boolean {
  if (a.kind !== b.kind) {
    return false;
  }

  if (a.kind === DATE_GROUP_KIND.MONTH && b.kind === DATE_GROUP_KIND.MONTH) {
    return a.year === b.year && a.month === b.month;
  }

  return true;
}

export function groupMovements(
  items: MovementView[],
  nowIso: string,
): { group: DateGroup; items: MovementView[] }[] {
  const groups: { group: DateGroup; items: MovementView[] }[] = [];

  for (const item of items) {
    const group = getDateGroup(item.createdAt, nowIso);
    const last = groups.at(-1);

    if (last && sameGroup(last.group, group)) {
      last.items.push(item);
    } else {
      groups.push({ group, items: [item] });
    }
  }

  return groups;
}

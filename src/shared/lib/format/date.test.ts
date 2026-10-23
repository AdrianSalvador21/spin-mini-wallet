import { describe, expect, it } from "vitest";
import type { MovementView } from "@/shared/lib/api/views";
import {
  DATE_GROUP_KIND,
  formatDayAndTime,
  formatLongDate,
  formatMonthLabel,
  formatReceiptDate,
  formatTime,
  getDateGroup,
  groupMovements,
} from "./date";

const NOW_ISO = "2026-10-22T18:00:00.000Z";

function buildMovement(id: string, createdAt: string): MovementView {
  return {
    id: id as MovementView["id"],
    type: "cash_deposit",
    direction: "credit",
    amount: { amountInCents: 100 as MovementView["amount"]["amountInCents"], currency: "MXN" },
    createdAt,
  };
}

describe("getDateGroup", () => {
  it("puts a movement from 00:05 Mexico City time today in today", () => {
    expect(getDateGroup("2026-10-22T06:05:00.000Z", NOW_ISO)).toEqual({ kind: DATE_GROUP_KIND.TODAY });
  });

  it("puts a movement from 23:55 Mexico City time yesterday in yesterday", () => {
    expect(getDateGroup("2026-10-22T05:55:00.000Z", NOW_ISO)).toEqual({ kind: DATE_GROUP_KIND.YESTERDAY });
  });

  it("puts a movement 6 days old in this_week", () => {
    expect(getDateGroup("2026-10-16T18:00:00.000Z", NOW_ISO)).toEqual({ kind: DATE_GROUP_KIND.THIS_WEEK });
  });

  it("puts a movement 7 days old in its calendar month", () => {
    expect(getDateGroup("2026-10-15T18:00:00.000Z", NOW_ISO)).toEqual({
      kind: DATE_GROUP_KIND.MONTH,
      year: 2026,
      month: 10,
    });
  });

  it("puts a movement from a previous year in its calendar month and year", () => {
    expect(getDateGroup("2025-12-15T18:00:00.000Z", NOW_ISO)).toEqual({
      kind: DATE_GROUP_KIND.MONTH,
      year: 2025,
      month: 12,
    });
  });
});

describe("formatTime", () => {
  it("formats the Mexico City hour and minute", () => {
    expect(formatTime("2026-10-21T15:42:00.000Z")).toBe("09:42");
  });
});

describe("formatDayAndTime", () => {
  it("formats the day, abbreviated month and time", () => {
    expect(formatDayAndTime("2026-10-19T14:12:00.000Z")).toBe("19 oct, 08:12");
  });
});

describe("formatReceiptDate", () => {
  it("formats the day, abbreviated month, year and Mexico City time with an h suffix", () => {
    expect(formatReceiptDate("2026-10-21T16:42:00.000Z")).toBe("21 oct 2026, 10:42 h");
  });

  it("keeps a two-digit hour for a morning time", () => {
    expect(formatReceiptDate("2026-01-05T14:05:00.000Z")).toBe("5 ene 2026, 08:05 h");
  });
});

describe("formatLongDate", () => {
  it("capitalizes the weekday and joins day and month with de", () => {
    expect(formatLongDate(NOW_ISO)).toBe("Jueves 22 de octubre");
  });
});

describe("formatMonthLabel", () => {
  it("omits the year when it matches now's year", () => {
    expect(formatMonthLabel(2026, 10, NOW_ISO)).toBe("Octubre");
  });

  it("includes the year when it is not the current one", () => {
    expect(formatMonthLabel(2025, 9, NOW_ISO)).toBe("Septiembre 2025");
  });
});

describe("groupMovements", () => {
  it("merges consecutive items with the same group and keeps list order", () => {
    const items = [
      buildMovement("1", "2026-10-22T06:05:00.000Z"),
      buildMovement("2", "2026-10-22T10:00:00.000Z"),
      buildMovement("3", "2026-10-22T05:55:00.000Z"),
      buildMovement("4", "2025-12-15T18:00:00.000Z"),
    ];

    const grouped = groupMovements(items, NOW_ISO);

    expect(grouped).toEqual([
      { group: { kind: DATE_GROUP_KIND.TODAY }, items: [items[0], items[1]] },
      { group: { kind: DATE_GROUP_KIND.YESTERDAY }, items: [items[2]] },
      { group: { kind: DATE_GROUP_KIND.MONTH, year: 2025, month: 12 }, items: [items[3]] },
    ]);
  });

  it("returns an empty list for no items", () => {
    expect(groupMovements([], NOW_ISO)).toEqual([]);
  });
});

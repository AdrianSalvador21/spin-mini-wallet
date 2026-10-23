import { describe, expect, it } from "vitest";
import { clampPosition, hasMoved, parseStoredPosition, placementFor } from "./drag-position";

const VIEWPORT = { width: 400, height: 800 };
const PILL = { width: 120, height: 44 };

describe("clampPosition", () => {
  it("keeps a position that is already inside the viewport", () => {
    expect(clampPosition({ x: 100, y: 300 }, PILL, VIEWPORT)).toEqual({
      x: 100,
      y: 300,
    });
  });

  it.each([
    ["the left and top edges", { x: -50, y: -20 }, { x: 8, y: 8 }],
    ["the right and bottom edges", { x: 390, y: 790 }, { x: 272, y: 748 }],
  ])("keeps it 8 px from %s", (_label, position, expected) => {
    expect(clampPosition(position, PILL, VIEWPORT)).toEqual(expected);
  });

  it("pins it to the margin when the element is wider than the viewport", () => {
    expect(clampPosition({ x: 50, y: 50 }, { width: 500, height: 44 }, VIEWPORT)).toEqual({ x: 8, y: 50 });
  });
});

describe("placementFor", () => {
  it.each([
    ["top left", { x: 10, y: 10 }, { vertical: "below", horizontal: "start" }],
    ["top right", { x: 270, y: 10 }, { vertical: "below", horizontal: "end" }],
    ["bottom left", { x: 10, y: 700 }, { vertical: "above", horizontal: "start" }],
    ["bottom right", { x: 270, y: 700 }, { vertical: "above", horizontal: "end" }],
  ])("opens the card toward the free space from the %s", (_label, position, expected) => {
    expect(placementFor(position, PILL, VIEWPORT)).toEqual(expected);
  });
});

describe("hasMoved", () => {
  it("ignores a move shorter than the threshold and accepts a longer one", () => {
    expect(hasMoved({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
    expect(hasMoved({ x: 0, y: 0 }, { x: 6, y: 0 })).toBe(true);
  });
});

describe("parseStoredPosition", () => {
  it("reads a stored point", () => {
    expect(parseStoredPosition('{"x":12,"y":34}')).toEqual({ x: 12, y: 34 });
  });

  it.each([
    ["nothing", null],
    ["invalid JSON", "{"],
    ["a non-object", "5"],
    ["missing coordinates", '{"x":1}'],
    ["non-numeric coordinates", '{"x":"a","y":2}'],
  ])("returns null for %s", (_label, raw) => {
    expect(parseStoredPosition(raw)).toBeNull();
  });
});

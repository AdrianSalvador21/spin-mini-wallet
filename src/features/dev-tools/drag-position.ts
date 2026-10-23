export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const DRAG_EDGE_MARGIN_PX = 8;
export const DRAG_THRESHOLD_PX = 6;

export const PLACEMENT_VERTICAL = {
  ABOVE: "above",
  BELOW: "below",
} as const;

export type PlacementVertical = (typeof PLACEMENT_VERTICAL)[keyof typeof PLACEMENT_VERTICAL];

export const PLACEMENT_HORIZONTAL = {
  START: "start",
  END: "end",
} as const;

export type PlacementHorizontal = (typeof PLACEMENT_HORIZONTAL)[keyof typeof PLACEMENT_HORIZONTAL];

export interface Placement {
  vertical: PlacementVertical;
  horizontal: PlacementHorizontal;
}

export const DEFAULT_PLACEMENT: Placement = {
  vertical: PLACEMENT_VERTICAL.ABOVE,
  horizontal: PLACEMENT_HORIZONTAL.START,
};

export const DESKTOP_PLACEMENT: Placement = {
  vertical: PLACEMENT_VERTICAL.ABOVE,
  horizontal: PLACEMENT_HORIZONTAL.END,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function clampPosition(position: Point, size: Size, viewport: Size, margin = DRAG_EDGE_MARGIN_PX): Point {
  return {
    x: clamp(position.x, margin, viewport.width - size.width - margin),
    y: clamp(position.y, margin, viewport.height - size.height - margin),
  };
}

export function placementFor(position: Point, size: Size, viewport: Size): Placement {
  const centerX = position.x + size.width / 2;
  const centerY = position.y + size.height / 2;

  return {
    vertical: centerY > viewport.height / 2 ? PLACEMENT_VERTICAL.ABOVE : PLACEMENT_VERTICAL.BELOW,
    horizontal: centerX > viewport.width / 2 ? PLACEMENT_HORIZONTAL.END : PLACEMENT_HORIZONTAL.START,
  };
}

export function hasMoved(start: Point, current: Point, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

export function parseStoredPosition(raw: string | null): Point | null {
  if (raw === null) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);

    if (
      typeof value === "object" &&
      value !== null &&
      "x" in value &&
      "y" in value &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y)
    ) {
      return { x: value.x as number, y: value.y as number };
    }
  } catch {
    return null;
  }

  return null;
}

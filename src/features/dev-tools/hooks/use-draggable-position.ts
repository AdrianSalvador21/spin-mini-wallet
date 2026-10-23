import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  clampPosition,
  DEFAULT_PLACEMENT,
  hasMoved,
  parseStoredPosition,
  placementFor,
  type Placement,
  type Point,
  type Size,
} from "../drag-position";

export const DEV_PANEL_POSITION_KEY = "smw.dev-panel-position";

const PRIMARY_BUTTON = 0;

interface DragSession {
  pointerId: number;
  start: Point;
  origin: Point;
  size: Size;
  last: Point | null;
}

function readStoredPosition(): Point | null {
  try {
    return parseStoredPosition(window.localStorage.getItem(DEV_PANEL_POSITION_KEY));
  } catch {
    return null;
  }
}

function storePosition(position: Point): void {
  try {
    window.localStorage.setItem(DEV_PANEL_POSITION_KEY, JSON.stringify(position));
  } catch {}
}

function viewport(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

function sizeOf(element: HTMLElement): Size {
  const rect = element.getBoundingClientRect();

  return { width: rect.width, height: rect.height };
}

export function useDraggablePosition(enabled: boolean) {
  const containerRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const draggedRef = useRef(false);
  const [position, setPosition] = useState<Point | null>(readStoredPosition);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function clampToViewport() {
      const element = containerRef.current;

      setPosition((current) => (current && element ? clampPosition(current, sizeOf(element), viewport()) : current));
    }

    clampToViewport();
    window.addEventListener("resize", clampToViewport);

    return () => window.removeEventListener("resize", clampToViewport);
  }, [enabled]);

  function measurePlacement() {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    setPlacement(placementFor({ x: rect.left, y: rect.top }, sizeOf(element), viewport()));
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    const element = containerRef.current;

    if (!enabled || !element || event.button !== PRIMARY_BUTTON) {
      return;
    }

    const rect = element.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: rect.left, y: rect.top },
      size: { width: rect.width, height: rect.height },
      last: null,
    };
    draggedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const current = { x: event.clientX, y: event.clientY };

    if (drag.last === null && !hasMoved(drag.start, current)) {
      return;
    }

    drag.last = clampPosition(
      {
        x: drag.origin.x + current.x - drag.start.x,
        y: drag.origin.y + current.y - drag.start.y,
      },
      drag.size,
      viewport(),
    );
    setPosition(drag.last);
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (drag.last === null) {
      return;
    }

    draggedRef.current = true;
    storePosition(drag.last);
    setPlacement(placementFor(drag.last, drag.size, viewport()));
  }

  function consumeDrag(): boolean {
    const dragged = draggedRef.current;
    draggedRef.current = false;

    return dragged;
  }

  return {
    containerRef,
    position: enabled ? position : null,
    placement,
    measurePlacement,
    consumeDrag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}

import { err, ok, type Result } from "../shared/result";
import type { MovementId } from "./types";

export interface MovementCursor {
  createdAt: string;
  id: MovementId;
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;
  return atob(base64 + "=".repeat(paddingLength));
}

export function encodeCursor(cursor: MovementCursor): string {
  return toBase64Url(`${cursor.createdAt}|${cursor.id}`);
}

export function decodeCursor(cursor: string): Result<MovementCursor, "CURSOR_INVALID"> {
  try {
    const decoded = fromBase64Url(cursor);
    const separatorIndex = decoded.indexOf("|");

    if (separatorIndex === -1) {
      return err("CURSOR_INVALID");
    }

    const createdAt = decoded.slice(0, separatorIndex);
    const id = decoded.slice(separatorIndex + 1);

    if (!createdAt || !id) {
      return err("CURSOR_INVALID");
    }

    return ok({ createdAt, id: id as MovementId });
  } catch {
    return err("CURSOR_INVALID");
  }
}

import { describe, expect, it } from "vitest";
import { TRANSFER_STATUS } from "./types";

describe("TRANSFER_STATUS", () => {
  it("matches the documented wire format", () => {
    expect(TRANSFER_STATUS).toEqual({ COMPLETED: "completed" });
  });
});

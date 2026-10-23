import "server-only";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createSessionEndHandler } from "./session-end-handler";

describe("createSessionEndHandler", () => {
  it("deletes the session cookie and redirects to /login", async () => {
    const handler = createSessionEndHandler();
    const request = new NextRequest("https://smw.test/session/end", {
      headers: { cookie: "smw_session=stale-token" },
    });

    const response = await handler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://smw.test/login");
    expect(response.headers.get("set-cookie")).toMatch(/smw_session=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

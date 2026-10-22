import { describe, expect, it } from "vitest";
import { json, readJsonBody } from "./json";

describe("readJsonBody", () => {
  it("returns ok with the parsed body for valid JSON", async () => {
    const request = new Request("https://smw.test/api/v1/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Mariana" }),
    });

    expect(await readJsonBody(request)).toEqual({ ok: true, value: { name: "Mariana" } });
  });

  it("returns err BODY_INVALID_JSON for malformed JSON", async () => {
    const request = new Request("https://smw.test/api/v1/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });

    expect(await readJsonBody(request)).toEqual({ ok: false, error: "BODY_INVALID_JSON" });
  });

  it("returns err BODY_INVALID_JSON for an empty body", async () => {
    const request = new Request("https://smw.test/api/v1/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    expect(await readJsonBody(request)).toEqual({ ok: false, error: "BODY_INVALID_JSON" });
  });
});

describe("json", () => {
  it("builds a Response with the given status and JSON body", async () => {
    const response = json({ ok: true }, 201);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
  });
});

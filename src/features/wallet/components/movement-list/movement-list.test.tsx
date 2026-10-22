import { http, HttpResponse, delay } from "msw";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/domain/money/money";
import { toMoney } from "@/domain/money/money";
import type { MovementView } from "@/shared/lib/api/views";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { server } from "@/test/msw/server";
import { getGroupLabel, getMovementsViewKind, MovementList } from "./movement-list";
import type { DateGroup } from "@/shared/lib/format/date";
import type { Translator } from "@/features/wallet/components/movement-row/movement-row";

const searchParamsMock = vi.fn(() => new URLSearchParams(""));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));

function setLocation(search: string) {
  window.history.replaceState(null, "", `/home${search}`);
}

function buildMovement(overrides: Partial<MovementView>): MovementView {
  return {
    id: "mov_1" as MovementView["id"],
    type: "cash_deposit",
    direction: "credit",
    amount: toMoney(5_000 as Cents),
    merchantName: "OXXO Reforma",
    createdAt: "2026-10-22T18:00:00.000Z",
    ...overrides,
  };
}

const NOW = "2026-10-22T18:00:00.000Z";

afterEach(() => {
  setLocation("");
  searchParamsMock.mockReturnValue(new URLSearchParams(""));
});

describe("getGroupLabel", () => {
  it("throws for a DateGroup kind outside the union", () => {
    const t = (() => "") as Translator;
    const invalid = { kind: "unknown" } as unknown as DateGroup;

    expect(() => getGroupLabel(t, invalid, NOW)).toThrow();
  });
});

describe("getMovementsViewKind", () => {
  it("returns loading while the query is pending", () => {
    expect(
      getMovementsViewKind({ isPending: true, isError: false, hasData: false, itemCount: 0, filter: "all" }),
    ).toBe("loading");
  });

  it("returns error when the first page failed and there is no data", () => {
    expect(
      getMovementsViewKind({ isPending: false, isError: true, hasData: false, itemCount: 0, filter: "all" }),
    ).toBe("error");
  });

  it("returns list when a next-page fetch fails but data already exists", () => {
    expect(
      getMovementsViewKind({ isPending: false, isError: true, hasData: true, itemCount: 1, filter: "all" }),
    ).toBe("list");
  });

  it("returns empty for no items under the all filter", () => {
    expect(
      getMovementsViewKind({ isPending: false, isError: false, hasData: true, itemCount: 0, filter: "all" }),
    ).toBe("empty");
  });

  it("returns empty_filtered for no items under a direction filter", () => {
    expect(
      getMovementsViewKind({ isPending: false, isError: false, hasData: true, itemCount: 0, filter: "credit" }),
    ).toBe("empty_filtered");
  });

  it("returns list when there are items", () => {
    expect(
      getMovementsViewKind({ isPending: false, isError: false, hasData: true, itemCount: 1, filter: "all" }),
    ).toBe("list");
  });
});

describe("MovementList", () => {
  it("groups rows under Hoy, Ayer, Esta semana and a month heading", async () => {
    server.use(
      http.get("/api/v1/wallet/movements", () =>
        HttpResponse.json({
          items: [
            buildMovement({ id: "1" as MovementView["id"], createdAt: "2026-10-22T06:05:00.000Z" }),
            buildMovement({ id: "2" as MovementView["id"], createdAt: "2026-10-22T05:55:00.000Z" }),
            buildMovement({ id: "3" as MovementView["id"], createdAt: "2026-10-16T18:00:00.000Z" }),
            buildMovement({ id: "4" as MovementView["id"], createdAt: "2025-12-15T18:00:00.000Z" }),
          ],
          nextCursor: null,
        }),
      ),
    );

    renderWithProviders(<MovementList now={NOW} />);

    expect(await screen.findByText("Hoy")).toBeInTheDocument();
    expect(screen.getByText("Ayer")).toBeInTheDocument();
    expect(screen.getByText("Esta semana")).toBeInTheDocument();
    expect(screen.getByText("Diciembre 2025")).toBeInTheDocument();
  });

  it("shows the first-page error state with retry and the reference", async () => {
    server.use(
      http.get(
        "/api/v1/wallet/movements",
        () =>
          HttpResponse.json(
            { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-1" } },
            { status: 503, headers: { "x-request-id": "req-1" } },
          ),
        { once: true },
      ),
    );

    renderWithProviders(<MovementList now={NOW} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar tus movimientos");
    expect(screen.getByText("Referencia: req-1")).toBeInTheDocument();
  });

  it("shows the empty state for the all filter", async () => {
    server.use(http.get("/api/v1/wallet/movements", () => HttpResponse.json({ items: [], nextCursor: null })));

    renderWithProviders(<MovementList now={NOW} />);

    expect(await screen.findByText("Aún no tienes movimientos")).toBeInTheDocument();
  });

  it("shows the filtered-empty state when a direction filter has no items", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("direction=credit"));
    server.use(http.get("/api/v1/wallet/movements", () => HttpResponse.json({ items: [], nextCursor: null })));

    renderWithProviders(<MovementList now={NOW} />);

    expect(await screen.findByText("No hay movimientos de este tipo")).toBeInTheDocument();
  });

  it("shows Ver más, loads the next page with 3 skeleton rows, then hides the button", async () => {
    server.use(
      http.get("/api/v1/wallet/movements", async ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");

        if (!cursor) {
          return HttpResponse.json({
            items: [buildMovement({ id: "1" as MovementView["id"] })],
            nextCursor: "10",
          });
        }

        await delay(50);

        return HttpResponse.json({
          items: [buildMovement({ id: "2" as MovementView["id"] })],
          nextCursor: null,
        });
      }),
    );

    renderWithProviders(<MovementList now={NOW} />);

    const moreButton = await screen.findByRole("button", { name: "Ver más movimientos" });
    await userEvent.click(moreButton);

    expect(await screen.findByRole("button", { name: "Cargando…" })).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole("button", { name: /Ver más|Cargando/ })).not.toBeInTheDocument());
  });

  it("keeps the loaded rows and shows the inline alert when the next page fails", async () => {
    server.use(
      http.get("/api/v1/wallet/movements", ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");

        if (!cursor) {
          return HttpResponse.json({
            items: [buildMovement({ id: "1" as MovementView["id"], merchantName: "OXXO Reforma" })],
            nextCursor: "10",
          });
        }

        return HttpResponse.json(
          { error: { code: "UPSTREAM_UNAVAILABLE", message: "errors.api.UPSTREAM_UNAVAILABLE", requestId: "req-2" } },
          { status: 503 },
        );
      }),
    );

    renderWithProviders(<MovementList now={NOW} />);

    const moreButton = await screen.findByRole("button", { name: "Ver más movimientos" });
    await userEvent.click(moreButton);

    expect(await screen.findByText("No pudimos cargar más movimientos.")).toBeInTheDocument();
    expect(screen.getByText("Depósito en OXXO Reforma")).toBeInTheDocument();
  });

  it("pushes ?direction=credit when choosing Recibidos", async () => {
    setLocation("");
    searchParamsMock.mockReturnValue(new URLSearchParams(""));
    server.use(
      http.get("/api/v1/wallet/movements", () =>
        HttpResponse.json({ items: [buildMovement({ id: "1" as MovementView["id"] })], nextCursor: null }),
      ),
    );

    renderWithProviders(<MovementList now={NOW} />);
    await screen.findByText("Depósito en OXXO Reforma");

    await userEvent.click(screen.getByRole("radio", { name: "Recibidos" }));

    expect(window.location.search).toBe("?direction=credit");
  });

  it("requests only credits when the direction filter is credit", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("direction=credit"));

    server.use(
      http.get("/api/v1/wallet/movements", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("direction")).toBe("credit");

        return HttpResponse.json({
          items: [buildMovement({ id: "credit-1" as MovementView["id"], direction: "credit" })],
          nextCursor: null,
        });
      }),
    );

    renderWithProviders(<MovementList now={NOW} />);

    expect(await screen.findByText("Depósito en OXXO Reforma")).toBeInTheDocument();
  });
});

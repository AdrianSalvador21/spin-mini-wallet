import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { Button } from "./button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "./types";

describe("Button", () => {
  it("defaults to type button", () => {
    renderWithProviders(<Button variant={BUTTON_VARIANT.PRIMARY}>Enviar</Button>);

    expect(screen.getByRole("button", { name: "Enviar" })).toHaveAttribute("type", BUTTON_TYPE.BUTTON);
  });

  it("keeps an explicit type", () => {
    renderWithProviders(
      <Button variant={BUTTON_VARIANT.PRIMARY} type={BUTTON_TYPE.SUBMIT}>
        Enviar
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Enviar" })).toHaveAttribute("type", BUTTON_TYPE.SUBMIT);
  });

  it.each(Object.values(BUTTON_VARIANT))("applies the %s variant class", (variant) => {
    renderWithProviders(<Button variant={variant}>Enviar</Button>);

    expect(screen.getByRole("button").className).toContain(`button--${variant}`);
  });

  it("applies the block modifier", () => {
    renderWithProviders(
      <Button variant={BUTTON_VARIANT.PRIMARY} block>
        Enviar
      </Button>,
    );

    expect(screen.getByRole("button").className).toContain("button--block");
  });

  it("calls onClick when it is idle", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button variant={BUTTON_VARIANT.PRIMARY} onClick={onClick}>
        Enviar
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables itself, sets aria-busy, shows the loading label and ignores clicks while loading", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button variant={BUTTON_VARIANT.PRIMARY} loading loadingLabel="Enviando…" onClick={onClick}>
        Enviar
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Enviando…" });
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.className).toContain("button--loading");
    expect(screen.queryByText("Enviar")).not.toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps its text while loading when there is no loading label", () => {
    renderWithProviders(
      <Button variant={BUTTON_VARIANT.SECONDARY} loading>
        Cerrar sesión
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeDisabled();
  });

  it("does not set aria-busy when it is idle", () => {
    renderWithProviders(<Button variant={BUTTON_VARIANT.GHOST}>Enviar</Button>);

    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });
});

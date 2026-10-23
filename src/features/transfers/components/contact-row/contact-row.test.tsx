import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildContact } from "@/test/factories/contacts";
import { renderWithProviders, screen } from "@/test/render";
import { ContactRow } from "./contact-row";

describe("ContactRow", () => {
  it("is a radio named after the contact and described by the masked account", () => {
    renderWithProviders(<ContactRow contact={buildContact()} name="recipient" checked={false} onSelect={vi.fn()} />);

    const radio = screen.getByRole("radio", { name: /Carlos Ruiz/ });

    expect(radio).not.toBeChecked();
    expect(radio).toHaveAccessibleDescription("Celular •••• 6789");
  });

  it("reports the contact when selected", async () => {
    const onSelect = vi.fn();
    const contact = buildContact();
    renderWithProviders(<ContactRow contact={contact} name="recipient" checked={false} onSelect={onSelect} />);

    await userEvent.click(screen.getByText("Carlos Ruiz"));

    expect(onSelect).toHaveBeenCalledWith(contact);
  });

  it("marks the checked row", () => {
    renderWithProviders(<ContactRow contact={buildContact()} name="recipient" checked onSelect={vi.fn()} />);

    expect(screen.getByRole("radio")).toBeChecked();
    expect(screen.getByRole("radio").closest("label")?.className).toContain("contact-row--checked");
  });
});

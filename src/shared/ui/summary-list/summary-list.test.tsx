import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { SummaryList } from "./summary-list";

describe("SummaryList", () => {
  it("renders a description list with the rows in order", () => {
    const { container } = renderWithProviders(
      <SummaryList
        items={[
          { key: "to", label: "Para", value: "Carlos Ruiz" },
          { key: "fee", label: "Comisión", value: "$0.00" },
          { key: "after", label: "Saldo después", value: "$12,350.80" },
        ]}
      />,
    );

    const list = container.querySelector("dl");
    const terms = [...(list?.querySelectorAll("dt") ?? [])].map((term) => term.textContent);
    const values = [...(list?.querySelectorAll("dd") ?? [])].map((value) => value.textContent);

    expect(list).toBeInTheDocument();
    expect(terms).toEqual(["Para", "Comisión", "Saldo después"]);
    expect(values).toEqual(["Carlos Ruiz", "$0.00", "$12,350.80"]);
  });

  it("pairs each label with its value", () => {
    renderWithProviders(<SummaryList items={[{ key: "to", label: "Para", value: "Carlos Ruiz" }]} />);

    expect(screen.getByRole("term")).toHaveTextContent("Para");
    expect(screen.getByRole("definition")).toHaveTextContent("Carlos Ruiz");
  });
});

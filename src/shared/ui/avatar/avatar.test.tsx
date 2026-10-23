import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { Avatar } from "./avatar";
import { AVATAR_SIZE, AVATAR_TONE } from "./types";

describe("Avatar", () => {
  it("is hidden from assistive technology and shows the initials", () => {
    const { container } = renderWithProviders(
      <Avatar initials="ML" size={AVATAR_SIZE.MD} tone={AVATAR_TONE.SOFT} />,
    );

    const avatar = container.querySelector("span");

    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).toHaveTextContent("ML");
  });

  it.each(Object.values(AVATAR_SIZE))("applies the %s size class", (size) => {
    const { container } = renderWithProviders(<Avatar initials="ML" size={size} tone={AVATAR_TONE.SOFT} />);

    expect(container.querySelector("span")?.className).toContain(`avatar--${size}`);
  });

  it.each(Object.values(AVATAR_TONE))("applies the %s tone class", (tone) => {
    const { container } = renderWithProviders(<Avatar initials="ML" size={AVATAR_SIZE.MD} tone={tone} />);

    expect(container.querySelector("span")?.className).toContain(`avatar--${tone}`);
  });
});

import { describe, it, expect } from "vitest";
import React from "react";
import { renderWithProviders } from "./react-test-utils";
import { Icon } from "@controls/Icon";

describe("Icon component", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProviders(<Icon iconName="play" width={16} height={16} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders an svg element for a standard icon", () => {
    const { container } = renderWithProviders(<Icon iconName="play" width={16} height={16} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies the correct width and height styles", () => {
    const { container } = renderWithProviders(<Icon iconName="play" width={32} height={24} />);
    const svg = container.querySelector("svg");
    expect(svg?.style.width).toBe("32px");
    expect(svg?.style.height).toBe("24px");
  });
});


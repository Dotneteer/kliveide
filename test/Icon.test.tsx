import { describe, it, expect } from "vitest";
import React from "react";
import { renderWithProviders } from "./react-test-utils";
import { Icon } from "@controls/Icon";
import { iconLibrary } from "@renderer/theming/icon-defs";
import { fileIconLibrary } from "@renderer/theming/file-icon-defs";

/**
 * A stock (single-path) icon that no .svg file shadows.
 *
 * Chosen at run time rather than hard-coded: "play" used to serve here, but a
 * play.svg now overrides it, which would silently move these tests onto the
 * markup branch and leave the legacy path branch untested.
 */
const STOCK_ICON = (() => {
  const shadowed = new Set(fileIconLibrary.map((ic) => ic.name));
  const stock = iconLibrary.find((ic) => !shadowed.has(ic.name));
  if (!stock) throw new Error("No un-shadowed stock icon available for the test");
  return stock.name;
})();

describe("Icon component", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProviders(<Icon iconName={STOCK_ICON} width={16} height={16} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders an svg element for a stock single-path icon", () => {
    const { container } = renderWithProviders(<Icon iconName={STOCK_ICON} width={16} height={16} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies the correct width and height styles", () => {
    const { container } = renderWithProviders(<Icon iconName={STOCK_ICON} width={32} height={24} />);
    const svg = container.querySelector("svg");
    expect(svg?.style.width).toBe("32px");
    expect(svg?.style.height).toBe("24px");
  });

  describe("file-based icons", () => {
    it("renders an icon loaded from assets/icons", () => {
      const { container } = renderWithProviders(<Icon iconName="sun" width={16} height={16} />);
      const svg = container.querySelector("svg");

      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    });

    it("keeps every element of a multi-element icon", () => {
      const { container } = renderWithProviders(<Icon iconName="sun" width={16} height={16} />);
      const svg = container.querySelector("svg");

      // --- The regression a single-<path> implementation would fail: a Lucide
      // --- sun is a circle plus eight rays.
      expect(svg!.children.length).toBeGreaterThan(1);
      expect(svg?.querySelector("circle")).not.toBeNull();
      expect(svg?.querySelectorAll("path").length).toBe(8);
    });

    it("preserves the stroke paint attributes of the source file", () => {
      const { container } = renderWithProviders(<Icon iconName="sun" width={16} height={16} />);
      const svg = container.querySelector("svg");

      // --- Losing fill="none" would turn every outline icon into a blob
      expect(svg?.getAttribute("fill")).toBe("none");
      expect(svg?.getAttribute("stroke")).toBe("currentColor");
      expect(svg?.getAttribute("stroke-width")).toBe("2");
    });

    it("routes the requested colour through the CSS color property", () => {
      const { container } = renderWithProviders(
        <Icon iconName="sun" width={16} height={16} fill="#ff0000" />
      );
      const svg = container.querySelector("svg") as SVGSVGElement;

      // --- currentColor in the markup resolves against this
      expect(svg.style.color).toBe("rgb(255, 0, 0)");
      // --- and the fill must NOT be overwritten with the colour
      expect(svg.getAttribute("fill")).toBe("none");
    });

    it("applies opacity to strokes as well as fills", () => {
      const { container } = renderWithProviders(
        <Icon iconName="sun" width={16} height={16} opacity={0.5} />
      );
      const svg = container.querySelector("svg") as SVGSVGElement;

      expect(svg.style.strokeOpacity).toBe("0.5");
      expect(svg.style.fillOpacity).toBe("0.5");
    });

    it("honours the width, height and rotation props", () => {
      const { container } = renderWithProviders(
        <Icon iconName="sun" width={32} height={24} rotate={90} />
      );
      const svg = container.querySelector("svg") as SVGSVGElement;

      expect(svg.style.width).toBe("32px");
      expect(svg.style.height).toBe("24px");
      expect(svg.style.transform).toBe("rotate(90deg)");
    });

    it("renders the composite debug icon with a working mask", () => {
      const { container } = renderWithProviders(<Icon iconName="debug" width={20} height={20} />);
      const svg = container.querySelector("svg") as SVGSVGElement;

      // --- The mask must reach the DOM and be referenced by the scoped id
      const mask = svg.querySelector("mask");
      expect(mask).not.toBeNull();
      expect(mask!.getAttribute("id")).toBe("klive-icon-debug-bug-cutout");
      expect(svg.querySelector("g[mask]")!.getAttribute("mask")).toBe(
        "url(#klive-icon-debug-bug-cutout)"
      );
    });

    it("draws the same play triangle across the run/debug family", () => {
      // --- These four icons swap inside one toolbar split button, so the
      // --- triangle must not appear to move or resize between them: same path
      // --- data AND same group transform.
      const read = (name: string) => {
        const r = renderWithProviders(<Icon iconName={name} width={20} height={20} />);
        const group = [...r.container.querySelectorAll("g")].find((g) =>
          g.querySelector('path[d^="M5 5a2 2"]')
        )!;
        const info = {
          d: group.querySelector("path")!.getAttribute("d"),
          transform: group.getAttribute("transform"),
          strokeWidth: group.getAttribute("stroke-width")
        };
        r.unmount();
        return info;
      };

      const play = read("play");
      expect(play.d).not.toBeNull();
      expect(play.transform).not.toBeNull();

      for (const name of ["debug", "debug-continue", "debug-continue-with-bug"]) {
        expect(read(name), `${name} must match the play glyph`).toEqual(play);
      }
    });

  });
});

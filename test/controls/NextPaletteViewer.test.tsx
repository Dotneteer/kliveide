import { describe, it, expect, vi } from "vitest";
import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../react-test-utils";

import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { paletteCodeFromDeviceValue } from "@emu/machines/zxNext/palette";

/** A palette in the register layout the viewer documents, one distinct entry per index. */
const PALETTE = Array.from({ length: 256 }, (_, i) => i);

const cells = (container: HTMLElement) => container.querySelectorAll('[role="gridcell"]');

const cellAt = (container: HTMLElement, index: number) =>
  container.querySelector(`[role="gridcell"][aria-label="$${index.toString(16).toUpperCase().padStart(2, "0")}"]`) as HTMLElement;

describe("NextPaletteViewer", () => {
  it("draws all 256 entries", () => {
    const { container } = renderWithProviders(<NextPaletteViewer palette={PALETTE} />);
    expect(cells(container).length).toBe(256);
  });

  it("labels every row and column, at every size", () => {
    // The previous viewer dropped the index gutter entirely in its "small" mode, which is the mode
    // the sidebar used — so the panel that most needed to name an index was the one that could not.
    // There is no small mode any more, so there is no size at which the labels can go missing.
    const { container } = renderWithProviders(<NextPaletteViewer palette={PALETTE} />);
    const labels = [...container.querySelectorAll("div")]
      .filter((d) => d.childElementCount === 0 && /^[0-9A-F]$/.test(d.textContent ?? ""))
      .map((d) => d.textContent);
    // 16 column labels + 16 row labels.
    expect(labels.length).toBe(32);
  });

  it("sizes itself from the swatch, not from its container", () => {
    // The grid is a reference image: dragging the sidebar must not resize it. Fluid `1fr` columns
    // swung the cells 13.9px -> 30.2px across the usable sidebar range, and every one of those
    // widths was fractional, so the cell edges and quadrant rules sat off the pixel grid.
    const { container } = renderWithProviders(<NextPaletteViewer palette={PALETTE} />);
    const grid = container.querySelector('[role="grid"]') as HTMLElement;
    expect(grid.style.getPropertyValue("--palette-cell")).toBe("14px");
  });

  it("lets a caller pick the swatch size", () => {
    // The .pal editor and the sprite editor sit in open-ended flex rows and want their own
    // measurements (29px and 17px), which reproduce the widths their old fixed columns reserved.
    const { container } = renderWithProviders(<NextPaletteViewer palette={PALETTE} cellSize={29} />);
    const grid = container.querySelector('[role="grid"]') as HTMLElement;
    expect(grid.style.getPropertyValue("--palette-cell")).toBe("29px");
  });

  it("paints a swatch with the colour its code renders to", () => {
    const palette = [...PALETTE];
    palette[0] = paletteCodeFromDeviceValue(0x005); // Spectrum blue
    const { container } = renderWithProviders(<NextPaletteViewer palette={palette} />);
    expect(cellAt(container, 0).style.backgroundColor).toBe("rgb(0, 0, 182)"); // #0000B6
  });

  describe("keyboard navigation", () => {
    const setup = () => {
      const onSelection = vi.fn();
      const { container } = renderWithProviders(
        <NextPaletteViewer
          palette={PALETTE}
          allowSelection
          selectedIndex={0xf0}
          onSelection={onSelection}
        />
      );
      const host = container.querySelector('[tabindex="0"]') as HTMLElement;
      return { host, onSelection };
    };

    it("wraps ArrowDown from the last row back to the first", () => {
      // The bug: the wrap tested `> 256`, so $F0 + 16 = 256 passed straight through — one past the
      // end of a 256-entry palette, and every consumer then read `palette[256]`, i.e. undefined.
      const { host, onSelection } = setup();
      fireEvent.keyDown(host, { code: "ArrowDown" });
      expect(onSelection).toHaveBeenCalledWith(0);
    });

    it("wraps ArrowUp from the first row to the last", () => {
      const onSelection = vi.fn();
      const { container } = renderWithProviders(
        <NextPaletteViewer
          palette={PALETTE}
          allowSelection
          selectedIndex={0x00}
          onSelection={onSelection}
        />
      );
      const host = container.querySelector('[tabindex="0"]') as HTMLElement;
      fireEvent.keyDown(host, { code: "ArrowUp" });
      expect(onSelection).toHaveBeenCalledWith(0xf0);
    });

    it("keeps horizontal movement inside its own row", () => {
      const onSelection = vi.fn();
      const { container } = renderWithProviders(
        <NextPaletteViewer
          palette={PALETTE}
          allowSelection
          selectedIndex={0x2f}
          onSelection={onSelection}
        />
      );
      const host = container.querySelector('[tabindex="0"]') as HTMLElement;
      fireEvent.keyDown(host, { code: "ArrowRight" });
      expect(onSelection).toHaveBeenCalledWith(0x20);
    });

    it("never selects an index the palette does not have", () => {
      const { host, onSelection } = setup();
      for (const code of ["ArrowDown", "ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"]) {
        fireEvent.keyDown(host, { code });
      }
      for (const call of onSelection.mock.calls) {
        expect(call[0]).toBeGreaterThanOrEqual(0);
        expect(call[0]).toBeLessThan(256);
      }
    });

    it("passes an unhandled key on to the caller", () => {
      const onOtherKey = vi.fn();
      const { container } = renderWithProviders(
        <NextPaletteViewer
          palette={PALETTE}
          allowSelection
          selectedIndex={0}
          onOtherKey={onOtherKey}
        />
      );
      const host = container.querySelector('[tabindex="0"]') as HTMLElement;
      fireEvent.keyDown(host, { code: "Digit8" });
      expect(onOtherKey).toHaveBeenCalledWith("Digit8");
    });
  });

  describe("selection", () => {
    it("reports a click only when the caller allows selection", () => {
      const onSelection = vi.fn();
      const { container } = renderWithProviders(
        <NextPaletteViewer palette={PALETTE} onSelection={onSelection} />
      );
      fireEvent.click(cellAt(container, 0x2a));
      expect(onSelection).not.toHaveBeenCalled();
    });

    it("reports the clicked index when it does", () => {
      const onSelection = vi.fn();
      const { container } = renderWithProviders(
        <NextPaletteViewer palette={PALETTE} allowSelection onSelection={onSelection} />
      );
      fireEvent.click(cellAt(container, 0x2a));
      expect(onSelection).toHaveBeenCalledWith(0x2a);
    });

    it("marks the selected swatch and only that one", () => {
      const { container } = renderWithProviders(
        <NextPaletteViewer palette={PALETTE} allowSelection selectedIndex={0x2a} />
      );
      const selected = [...cells(container)].filter(
        (c) => c.getAttribute("aria-selected") === "true"
      );
      expect(selected.length).toBe(1);
      expect(selected[0].getAttribute("aria-label")).toBe("$2A");
    });
  });

  describe("the readout", () => {
    it("mounts one tooltip for the whole grid, not one per swatch", () => {
      // 256 TooltipFactory instances per palette was the previous shape, and the sidebar drew
      // eight palettes. There is one pointer, so there is one readout.
      const { container } = renderWithProviders(<NextPaletteViewer palette={PALETTE} />);
      // Nothing is hovered, so nothing is shown — and crucially, no per-cell portal exists either.
      expect(document.querySelectorAll("[data-popper-placement]").length).toBe(0);
      expect(cells(container).length).toBe(256);
    });

    it("reports the hovered entry's index and RGB", async () => {
      const palette = [...PALETTE];
      palette[0x2a] = paletteCodeFromDeviceValue(0x1f8); // bright yellow: R7 G7 B0
      const { container } = renderWithProviders(<NextPaletteViewer palette={palette} />);
      fireEvent.mouseEnter(cellAt(container, 0x2a));
      expect(await screen.findByText(/\$2A — R: 7, G: 7, B: 0/)).toBeTruthy();
    });

    it("names the transparency entry", async () => {
      const { container } = renderWithProviders(
        <NextPaletteViewer palette={PALETTE} transparencyIndex={0xe3} />
      );
      fireEvent.mouseEnter(cellAt(container, 0xe3));
      expect(await screen.findByText(/\(transparency\)/)).toBeTruthy();
    });
  });

  it("marks the transparency entry and only that one", () => {
    const { container } = renderWithProviders(
      <NextPaletteViewer palette={PALETTE} transparencyIndex={0xe3} />
    );
    const marked = [...cells(container)].filter((c) => c.childElementCount > 0);
    expect(marked.length).toBe(1);
    expect(marked[0].getAttribute("aria-label")).toBe("$E3");
  });

  it("marks the priority entries only when the caller asked for priority", () => {
    const palette = [...PALETTE];
    palette[0x10] |= 0x8000;
    const withoutPriority = renderWithProviders(<NextPaletteViewer palette={palette} />);
    expect(
      [...cells(withoutPriority.container)].filter((c) => c.childElementCount > 0).length
    ).toBe(0);

    const withPriority = renderWithProviders(<NextPaletteViewer palette={palette} usePriority />);
    const marked = [...cells(withPriority.container)].filter((c) => c.childElementCount > 0);
    expect(marked.length).toBe(1);
    expect(marked[0].getAttribute("aria-label")).toBe("$10");
  });

  it("survives a palette shorter than 256 entries", () => {
    // `.nex` and `.pal` readers hand over whatever the file held; a short array used to render
    // `undefined` straight into the colour lookup.
    const { container } = renderWithProviders(<NextPaletteViewer palette={[1, 2, 3]} />);
    expect(cells(container).length).toBe(256);
    expect(cellAt(container, 0xff).style.backgroundColor).toBe("rgb(0, 0, 0)");
  });
});

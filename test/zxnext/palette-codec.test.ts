import { describe, it, expect } from "vitest";

import {
  getAbrgForPaletteCode,
  getCssStringForPaletteCode,
  getLuminanceForPaletteCode,
  getRgbPartsForPaletteCode,
  paletteCodeFromDeviceValue
} from "@emu/machines/zxNext/palette";

/**
 * The palette bit layouts.
 *
 * The Next holds a 9-bit RGB333 colour in two different packings — the *register* layout
 * (`RRRGGGBB` with the low blue bit in bit 8) and the *device* layout (a straight `RRRGGGBBB`) —
 * and they are a one-bit rotation apart. That is exactly what made mixing them so quiet: greys and
 * whites survive the rotation unchanged, so a mis-converted palette still looks like a palette, and
 * only saturated colours land on a plausible-looking wrong colour.
 *
 * These tests pin the direction each function speaks, because nothing else can: no value can be
 * classified by inspection, both layouts cover the same 0..511 range.
 */

/** The ULA power-on palette, straight from `PaletteDevice.defaultUlaColors` (device layout). */
const DEVICE_ULA = [
  0x000, 0x005, 0x140, 0x145, 0x028, 0x02d, 0x168, 0x16d, 0x000, 0x007, 0x1c0, 0x1c7, 0x038, 0x03f,
  0x1f8, 0x1ff
];

/** What those sixteen entries must render as — `zxNextRgb333Codes` at the same index. */
const EXPECTED_ULA_CSS = [
  "#000000", // black
  "#0000B6", // blue
  "#B60000", // red
  "#B600B6", // magenta
  "#00B600", // green
  "#00B6B6", // cyan
  "#B6B600", // yellow
  "#B6B6B6", // white
  "#000000", // bright black
  "#0000FF", // bright blue
  "#FF0000", // bright red
  "#FF00FF", // bright magenta
  "#00FF00", // bright green
  "#00FFFF", // bright cyan
  "#FFFF00", // bright yellow
  "#FFFFFF" // bright white
];

/**
 * The hardware's 3-bit -> 8-bit expansion: the three bits replicated across the byte.
 * `001` -> `00100100` = 0x24, not 0x25.
 */
const INTENSITY = [0x00, 0x24, 0x49, 0x6d, 0x92, 0xb6, 0xdb, 0xff];

describe("Next palette bit layouts", () => {
  describe("the component intensity ramp", () => {
    it("is the same in every table that renders a Next colour", () => {
      // Three tables encode this ramp: `zxNextBgra` (the emulator's screen), `zxNextRgb333Codes`
      // (the CSS path) and `colorIntensity` inside `palette.ts` (the ABRG path the Layer 2 and
      // sprite previews draw through). The last carried 0x25 at level 1 and rendered that one
      // level a step brighter than the machine's own screen.
      for (let level = 0; level < 8; level++) {
        const code = paletteCodeFromDeviceValue((level << 6) | (level << 3) | level);
        const abrg = getAbrgForPaletteCode(code);
        expect(abrg & 0xff).toBe(INTENSITY[level]); // red
        expect((abrg >> 8) & 0xff).toBe(INTENSITY[level]); // green
        expect((abrg >> 16) & 0xff).toBe(INTENSITY[level]); // blue
        expect(getCssStringForPaletteCode(code)).toBe(
          "#" + INTENSITY[level].toString(16).padStart(2, "0").toUpperCase().repeat(3)
        );
      }
    });
  });

  describe("paletteCodeFromDeviceValue", () => {
    it("renders the ULA power-on palette as the Spectrum colours", () => {
      // The regression this exists for: the sidebar panel fed device values straight into the
      // viewer, so `$005` — Spectrum blue — drew as #002449, a dark teal.
      const rendered = DEVICE_ULA.map((v) =>
        getCssStringForPaletteCode(paletteCodeFromDeviceValue(v))
      );
      expect(rendered).toEqual(EXPECTED_ULA_CSS);
    });

    it("is the inverse of the rotation getCssStringForPaletteCode undoes", () => {
      for (let device = 0; device < 512; device++) {
        const code = paletteCodeFromDeviceValue(device);
        // Rotating the register code back left must reproduce the device value exactly.
        const back = ((code << 1) & 0x1ff) | ((code >> 8) & 0x01);
        expect(back).toBe(device);
      }
    });

    it("never produces a code outside the 9 bits a palette entry has", () => {
      for (let device = 0; device < 512; device++) {
        expect(paletteCodeFromDeviceValue(device) & ~0x1ff).toBe(0);
      }
    });

    it("matches the device's own `nextReg41Value` derivation", () => {
      // `PaletteDevice.nextReg41Value` is literally `stored >> 1`, and the ninth bit is the
      // stored value's bit 0. If this ever disagrees, one of the two is wrong about the hardware.
      for (let device = 0; device < 512; device++) {
        const code = paletteCodeFromDeviceValue(device);
        expect(code & 0xff).toBe(device >> 1);
        expect((code >> 8) & 1).toBe(device & 1);
      }
    });
  });

  describe("getRgbPartsForPaletteCode", () => {
    it("decodes the register layout, the same one every other function here takes", () => {
      // The bug: this alone decoded the *device* layout, so the viewer's tooltip and the swatch
      // beside it disagreed about the same number — and each was right for a different caller.
      expect(getRgbPartsForPaletteCode(0b111_000_00 | (1 << 8))).toEqual([7, 0, 1]);
      expect(getRgbPartsForPaletteCode(0b000_111_00)).toEqual([0, 7, 0]);
      expect(getRgbPartsForPaletteCode(0b000_000_11 | (1 << 8))).toEqual([0, 0, 7]);
    });

    it("agrees with the CSS the same code renders to", () => {
      for (let device = 0; device < 512; device++) {
        const code = paletteCodeFromDeviceValue(device);
        const [r, g, b] = getRgbPartsForPaletteCode(code);
        const expected =
          "#" +
          [INTENSITY[r], INTENSITY[g], INTENSITY[b]]
            .map((c) => c.toString(16).padStart(2, "0").toUpperCase())
            .join("");
        expect(getCssStringForPaletteCode(code)).toBe(expected);
      }
    });

    it("ignores the priority flag the editors park in bit 15", () => {
      const code = paletteCodeFromDeviceValue(0x145);
      expect(getRgbPartsForPaletteCode(code | 0x8000)).toEqual(getRgbPartsForPaletteCode(code));
    });
  });

  describe("getLuminanceForPaletteCode", () => {
    it("puts black at the bottom and white at the top of its 0..7 scale", () => {
      expect(getLuminanceForPaletteCode(paletteCodeFromDeviceValue(0x000))).toBe(0);
      expect(getLuminanceForPaletteCode(paletteCodeFromDeviceValue(0x1ff))).toBeCloseTo(7, 5);
    });

    it("straddles the 3.5 midpoint the mark colours are chosen against", () => {
      // Spectrum blue is dark, bright yellow is not. If these ever land on the same side, every
      // mark drawn over a swatch has picked its contrast from a broken luminance.
      expect(getLuminanceForPaletteCode(paletteCodeFromDeviceValue(0x005))).toBeLessThan(3.5);
      expect(getLuminanceForPaletteCode(paletteCodeFromDeviceValue(0x1f8))).toBeGreaterThan(3.5);
    });
  });
});

import { describe, expect, it } from "vitest";

import { for48And128AndP3e } from "./wasm-test-helpers";

/*
 * The first visible row's left border.
 *
 * The ULA timing table draws a row's left border at the end of the raster line before it. The table
 * started at the first visible line, so row 0's left border - the tail of the line before - was never
 * drawn: those 48 pixels kept whatever was there before, which after a boot with a white border and
 * a program that changed it showed as a grey segment at the top left (reported on the +2A/+3; the
 * renderer is shared, so every Spectrum core had it).
 */

/** Width of the left border in pixels: 24 tacts, two pixels each */
const LEFT_BORDER_PIXELS = 48;

describe("ZX Spectrum WASM ULA: the first row's left border", () => {
  for48And128AndP3e((testCase) => {
    it(`${testCase.name} draws it in the current border colour`, async () => {
      const machine = await testCase.createWasmMachine();
      for (const border of [0x07, 0x02]) {
        machine.writeTestPort(0x00fe, border);
        machine.executeMachineFrame();
        machine.executeMachineFrame();
        const pixels = machine.getPixelBuffer();
        // --- The middle of row 0 is plain border; its left end must match it
        const borderPixel = pixels[LEFT_BORDER_PIXELS + 100];
        const leftEnd = Array.from(pixels.subarray(0, LEFT_BORDER_PIXELS));
        expect(leftEnd.every((p) => p === borderPixel), `border ${border}`).toBe(true);
      }
    });
  });
});

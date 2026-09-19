import { describe, expect, it } from "vitest";

import { ALL_CORES, rgb333ToHex, type CoreName } from "../../harness/zxnext";
import { colours, parkedSession } from "../ula/_ula-helpers";

/*
 * The $4A fallback colour's 9th bit (ported from test/zxnext/UlaDisableFallback.test.ts, whose TS half
 * read a device cache field and whose WASM half poked the core directly).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~7160: `rgb_out_2 <= fallback_rgb_2 & (fallback_rgb_2(1) or fallback_rgb_2(0))` - the 8-bit $4A
 *   value becomes RRRGGGBB plus a low blue bit that is B1 OR B0 (blue 10 -> 101, not 100 or 110).
 * - ~7046-7049: with $68 bit 7 the ULA (border included) is transparent; with no other layer enabled
 *   every pixel is the fallback colour. (nextreg/fallback-colour-reset.test.ts shows $E3 that way.)
 * The expected colours are written as 9-bit components, not through next8ToHex.
 */

/** [$4A, red, green, blue (3 bits each)] */
const CASES: Array<[number, number, number, number]> = [
  [0x00, 0, 0, 0],
  [0x01, 0, 0, 0b011],
  [0x02, 0, 0, 0b101],
  [0x03, 0, 0, 0b111],
  [0xe3, 7, 0, 0b111],
  [0x5c, 2, 7, 0b000],
  [0x96, 4, 5, 0b101]
];

describe.each(ALL_CORES)("$4A fallback colour - %s core", (core: CoreName) => {
  it("the whole frame shows $4A with the low blue bit = B1 or B0 when $68 bit 7 hides the ULA", async () => {
    const s = await parkedSession(core);
    s.setNextReg(0x68, 0x80).runFrames(1);
    const got: string[] = [];
    for (const [value] of CASES) {
      s.setNextReg(0x4a, value).runFrames(1);
      got.push(`$${value.toString(16).padStart(2, "0")}: ${colours(s, [0, 719], [0, 287])}`);
    }
    expect(got).toEqual(CASES.map(([v, r, g, b]) => `$${v.toString(16).padStart(2, "0")}: ${rgb333ToHex(r, g, b)}`));
  });
});

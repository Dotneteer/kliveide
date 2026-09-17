import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession } from "../../harness/zxnext";

/*
 * NextRegs a soft reset returns to their reset values.
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`): the `if reset = '1'` branches assign these values
 * (~4920-5002 for the video/palette/copper registers, ~4591-4598 for the MMU). A soft reset asserts
 * the same `reset` as a hard one for them. Values are read back through $243B/$253B.
 */
const RESET_VALUES: Array<[reg: number, value: number, what: string]> = [
  [0x12, 0x08, "Layer 2 active bank"],
  [0x13, 0x0b, "Layer 2 shadow bank"],
  [0x14, 0xe3, "global transparency"],
  [0x15, 0x00, "sprite/layer control"],
  [0x16, 0x00, "Layer 2 scroll X"],
  [0x17, 0x00, "Layer 2 scroll Y"],
  [0x32, 0x00, "LoRes scroll X"],
  [0x33, 0x00, "LoRes scroll Y"],
  [0x42, 0x07, "ULANext format"],
  [0x4a, 0xe3, "fallback colour"],
  [0x4b, 0xe3, "sprite transparency index"],
  [0x4c, 0x0f, "tilemap transparency index"],
  [0x50, 0xff, "MMU0"],
  [0x51, 0xff, "MMU1"],
  [0x52, 0x0a, "MMU2"],
  [0x53, 0x0b, "MMU3"],
  [0x54, 0x04, "MMU4"],
  [0x55, 0x05, "MMU5"],
  [0x56, 0x00, "MMU6"],
  [0x57, 0x01, "MMU7"],
  [0x6b, 0x00, "tilemap control"],
  [0x70, 0x00, "Layer 2 control"]
];

describe.each(ALL_CORES)("NextRegs after a soft reset - %s core", (core) => {
  it("return to their hardware reset values", async () => {
    const s = await createSession(core);
    // --- Move every register away from its reset value first.
    for (const [reg, value] of RESET_VALUES) s.setNextReg(reg, (value ^ 0x15) & (reg === 0x6b ? 0x7f : 0xff));
    s.reset();
    const actual = RESET_VALUES.map(([reg, , what]) => `$${reg.toString(16)} ${what}: $${s.readNextReg(reg).toString(16)}`);
    const expected = RESET_VALUES.map(([reg, value, what]) => `$${reg.toString(16)} ${what}: $${value.toString(16)}`);
    expect(actual).toEqual(expected);
  });
});

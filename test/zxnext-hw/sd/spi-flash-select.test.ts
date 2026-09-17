import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";
import type { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

/*
 * B2 - which SPI slave a write of $7F to port $E7 selects.
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd` ~3316): `port_e7_reg <= X"7F"` (FPGA flash) only when
 * `nr_03_config_mode = '1' or nr_02_reset_type(2) = '1'`; otherwise every slave is deselected ($FF).
 * - `nr_02_reset_type` is "100" at power-on and shifts on every soft reset (~1692: `'0' & rt(2) &
 *   (rt(1) or rt(0))`), so bit 2 is set only until the first soft reset. Writes to $02 do not change it.
 * - Config mode is entered by writing `111` to NextReg $03's low bits and left by any other non-zero
 *   value (~5125-5129). Klive starts after the firmware, so both cores start (and soft-reset) with
 *   config mode off - the TypeScript core's `NextRegDevice.configMode`, mirrored here.
 * - NextReg $14 (global transparency) has nothing to do with any of it.
 *
 * WASM only, and through the core's `zxnextGetSdPortE7Value` export: port $E7 is write-only and
 * neither core emulates the flash chip, so no program can see the difference yet. The TypeScript
 * core keeps no chip-select latch, only the selected SD card (covered in test/zxnext/SdCardDevice).
 */
describe("SPI chip select $7F (FPGA flash) - wasm core", () => {
  const e7 = (s: Awaited<ReturnType<typeof createSession>>) =>
    (s.machine as ZxNextWasmV2Machine).wasmV2Runtime!.exports.zxnextGetSdPortE7Value();

  it("is accepted after power-on (reset type bit 2), refused after a soft reset", async () => {
    const s = await createSession("wasm");
    s.out(0xe7, 0x7f);
    expect(e7(s)).toBe(0x7f);
    s.reset();
    for (const transparency of [0xe3, 0x5a]) {
      s.setNextReg(0x14, transparency).out(0xe7, 0x7f);
      expect(e7(s), `$14 = $${transparency.toString(16)}`).toBe(0xff);
    }
  });

  it("is accepted in config mode ($03 low bits 111) and refused again after leaving it", async () => {
    const s = await createSession("wasm");
    s.reset().setNextReg(0x14, 0x00);
    s.setNextReg(0x03, 0x07).out(0xe7, 0x7f);
    expect(e7(s)).toBe(0x7f);
    s.setNextReg(0x03, 0x00).out(0xe7, 0x7f); // --- 000 keeps config mode
    expect(e7(s)).toBe(0x7f);
    s.setNextReg(0x03, 0x03).out(0xe7, 0x7f); // --- any other non-zero value leaves it
    expect(e7(s)).toBe(0xff);
  });
});

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

/*
 * SPI-001 - the whole port $E7 decode (zxnext.vhd ~3305-3321), checked in VHDL order: the low two bits
 * win first (`10` -> $FE SD0, `01` -> $FD SD1), then the exact values $FB (Pi 0) and $F7 (Pi 1), then
 * $7F (flash, config mode or reset type bit 2 only); every other value deselects all slaves ($FF).
 */
describe("SPI chip select decode - wasm core", () => {
  const e7 = (s: Awaited<ReturnType<typeof createSession>>) =>
    (s.machine as ZxNextWasmV2Machine).wasmV2Runtime!.exports.zxnextGetSdPortE7Value();

  const CASES: Array<[written: number, latched: number, why: string]> = [
    [0xfe, 0xfe, "SD0"],
    [0xfd, 0xfd, "SD1"],
    [0x02, 0xfe, "low bits 10: SD0 whatever the upper bits"],
    [0x7e, 0xfe, "low bits 10"],
    [0xfa, 0xfe, "low bits 10 beat the upper bits"],
    [0x01, 0xfd, "low bits 01: SD1 whatever the upper bits"],
    [0xf9, 0xfd, "low bits 01"],
    [0xfb, 0xfb, "Raspberry Pi 0"],
    [0xf7, 0xf7, "Raspberry Pi 1"],
    [0xff, 0xff, "deselect all"],
    [0x00, 0xff, "low bits 00, not an exact value"],
    [0x03, 0xff, "low bits 11, not an exact value"],
    [0xf3, 0xff, "low bits 11, two slave bits clear"],
    [0xef, 0xff, "low bits 11, not an exact value"],
    [0xbf, 0xff, "low bits 11, not an exact value"],
    [0x7f, 0xff, "flash outside config mode, after a soft reset"]
  ];

  it("starts with every slave deselected", async () => {
    const s = await createSession("wasm");
    expect(e7(s)).toBe(0xff);
  });

  it.each(CASES)("$E7 <- %i latches the VHDL value", async (written, latched, why) => {
    const s = await createSession("wasm");
    s.reset();
    // --- Start from a selected card so a "deselect" result is a change, not the reset value.
    s.out(0xe7, 0xfe);
    s.out(0xe7, written);
    expect(e7(s), `$${written.toString(16)}: ${why}`).toBe(latched);
  });

  it("a soft reset deselects every slave", async () => {
    const s = await createSession("wasm");
    s.out(0xe7, 0xfd).reset();
    expect(e7(s)).toBe(0xff);
  });
});

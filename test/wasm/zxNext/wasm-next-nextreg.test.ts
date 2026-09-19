import { describe, expect, it } from "vitest";

import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM NextReg $06 (Peripheral 2)", () => {
  it("reads the firmware value after a hard reset and keeps bit 2 outside config mode", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();

    // --- Klive's hard reset models the firmware ("fast boot"), which leaves $06 = $98. The value
    // --- both cores agreed on at tag `pre-zxnext-ts-removal-2026-09-19`; the VHDL reset alone does
    // --- not decide it (see HARD_RESET_MASK in test/zxnext-hw/nextreg/soft-reset.test.ts).
    expect(readNextReg(wasm, 0x06)).toBe(0x98);

    // --- zxnext.vhd ~5139-5148: bits 7-3 and 1-0 are stored as written; bit 2 (PS/2 mode) only in
    // --- config mode, which the machine is not in after a hard reset. ~5845 reads the bits back.
    for (const [value, expected] of [
      [0x00, 0x00],
      [0xff, 0xfb],
      [0x24, 0x20],
      [0x98, 0x98]
    ]) {
      writeNextReg(wasm, 0x06, value);
      expect(readNextReg(wasm, 0x06), `value $${hex(value)}`).toBe(expected);
    }
  });
});

function writeNextReg(machine: ZxNextWasmV2Machine, reg: number, value: number): void {
  machine.doWritePort(0x243b, reg);
  machine.doWritePort(0x253b, value);
}

function readNextReg(machine: ZxNextWasmV2Machine, reg: number): number {
  machine.doWritePort(0x243b, reg);
  return machine.doReadPort(0x253b);
}

function hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

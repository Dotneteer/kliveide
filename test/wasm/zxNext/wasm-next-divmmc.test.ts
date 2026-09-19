import { describe, expect, it } from "vitest";

import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const OFFS_DIVMMC_ROM = 0x010000;
const OFFS_DIVMMC_RAM = 0x020000;
const OFFS_NEXT_ROM = 0x000000;

/** `zxnextGetMemoryPageWriteOffset` for a page that takes no writes */
const NO_WRITE_OFFSET = 0xffffffff;

/*
 * DivMMC paging, automap and entry points are covered by `test/zxnext-hw/divmmc/`. What stays here
 * is what the harness cannot see: the page table the core exports to the Memory Mapping panel, and
 * the entry-point register readback.
 */
describe("ZX Spectrum Next WASM DivMMC", () => {
  it("keeps exported page maps on the base MMU map while CONMEM overlays memory access", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();

    seedPhysical(wasm, OFFS_NEXT_ROM, 0x11);
    seedPhysical(wasm, OFFS_DIVMMC_ROM, 0xd1);
    seedPhysical(wasm, OFFS_DIVMMC_RAM + 0x2000, 0xd2);

    // --- $E3 = $81: conmem, RAM page 1 at $2000 (catalogue DIV-001)
    wasm.doWritePort(0xe3, 0x81);

    // --- The page table still names ROM 0 (read-only, no RAM bank) in pages 0/1: the DivMMC
    // --- overlay is not part of the MMU map.
    const exports = wasm.wasmV2Runtime!.exports;
    for (const page of [0, 1]) {
      expect(exports.zxnextGetMemoryPageReadOffset(page) >>> 0, `page ${page} read`).toBe(OFFS_NEXT_ROM + page * 0x2000);
      expect(exports.zxnextGetMemoryPageWriteOffset(page) >>> 0, `page ${page} write`).toBe(NO_WRITE_OFFSET);
      expect(exports.zxnextGetMemoryPageBank16(page), `page ${page} bank16`).toBe(0xff);
      expect(exports.zxnextGetMemoryPageBank8(page), `page ${page} bank8`).toBe(0xff);
    }
    // --- ...while memory access goes through the overlay: DivMMC ROM at $0000, RAM page 1 at $2000
    expect(wasm.doReadMemory(0x0000)).toBe(0xd1);
    expect(wasm.doReadMemory(0x2000)).toBe(0xd2);
  });

  it("reads the DivMMC entry-point NextRegs back whole", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();

    // --- zxnext.vhd ~5560-5570 store $B8-$BB as full bytes; ~6163-6173 read them back unchanged
    for (const [reg, value] of [
      [0xb8, 0xa5],
      [0xb9, 0x3c],
      [0xba, 0x5a],
      [0xbb, 0xf2]
    ] as const) {
      writeNextReg(wasm, reg, value);
      expect(readNextReg(wasm, reg), `reg $${hex(reg)}`).toBe(value);
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

function seedPhysical(wasm: ZxNextWasmV2Machine, offset: number, value: number): void {
  wasm.wasmV2Runtime!.memory[offset] = value;
}

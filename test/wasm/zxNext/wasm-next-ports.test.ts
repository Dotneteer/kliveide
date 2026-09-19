import { describe, expect, it } from "vitest";

import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";
import { ULA_BORDER_COLOR_NAMES } from "@common/messaging/EmuApi";

/*
 * What the IDE reads after port writes: the selected ROM/bank, the partition map and labels, the
 * NextReg state, the ULA panel state and the last-I/O-access fields. The port behaviour itself is
 * covered by `test/zxnext-hw/ports/` and `test/zxnext-hw/memory/`.
 */
describe("ZX Spectrum Next WASM port writes as the IDE sees them", () => {
  it("reports 0x7ffd paging and ignores writes after the lock", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();

    // --- $7FFD = $13: bank 3 at $C000 (MMU6/7 = 6/7), bit 4 selects ROM 1 (catalogue MEM-003, MEM-007).
    // --- $8E reads $DFFD bit 0, bank bits 2-0, 1, special-mode bits, ROM bit (zxnext.vhd ~6104; NR-018).
    wasm.doWritePort(0x7ffd, 0x13);
    expectMemoryPortState(wasm, 1, 3, [0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x06, 0x07], [
      "R1", "R1", "0A", "0B", "04", "05", "06", "07"
    ]);
    expectNextRegs(wasm, { 0x56: 0x06, 0x57: 0x07, 0x8e: 0x39 });
    expectLastWrite(wasm, 0x7ffd, 0x13);

    // --- $3F sets bank 7 and the lock (bit 5); the two later writes are ignored (catalogue MEM-009)
    wasm.doWritePort(0x7ffd, 0x3f);
    wasm.doWritePort(0x7ffd, 0x00);
    wasm.doWritePort(0x7ffd, 0x10);

    expectMemoryPortState(wasm, 1, 7, [0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x0e, 0x0f], [
      "R1", "R1", "0A", "0B", "04", "05", "0E", "0F"
    ]);
    expectNextRegs(wasm, { 0x56: 0x0e, 0x57: 0x0f, 0x8e: 0x79 });
    expectLastWrite(wasm, 0x7ffd, 0x10);
  });

  it("reports ULA port side effects and the read value", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();

    wasm.doWritePort(0x00fe, 0x18);
    const read = wasm.doReadPort(0x00fe);

    // --- zxnext.vhd ~3453-3465: bits 7 and 5 read 1, bit 6 is the last $FE bit 4 (EAR out, 1 here),
    // --- bits 4-0 the keyboard columns (no key pressed: all 1s)
    expect(read).toBe(0xff);
    // --- Border = $FE bits 2-0 = 0; `UlaState.bor` is its name (see ULA_BORDER_COLOR_NAMES)
    expect(wasm.getWasmV2UlaState().bor).toBe(ULA_BORDER_COLOR_NAMES[0x18 & 0x07]);
    expect(wasm.getWasmV2UlaState().ear).toBe(true);
    expect(wasm.getWasmV2UlaState().mic).toBe(true);
    expect(wasm.lastIoReadPort).toBe(0x00fe);
    expect(wasm.lastIoReadValue).toBe(read);
  });

  it("reads an open port as $FF and records the access", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();

    // --- $FFFF decodes as port $FF, which reads $FF in +3 timing (the machine after a hard reset;
    // --- catalogue PORT-006)
    const read = wasm.doReadPort(0xffff);

    expect(read).toBe(0xff);
    expect(wasm.lastIoReadPort).toBe(0xffff);
    expect(wasm.lastIoReadValue).toBe(read);
  });
});

/**
 * Reads NextRegs through the IDE interface, which reads without touching the bus, so the
 * last-I/O-access assertions that follow still see the test's own writes.
 */
function expectNextRegs(wasm: ZxNextWasmV2Machine, expected: Record<number, number>): void {
  const regs = wasm.getNextRegState().regs;
  for (const [reg, value] of Object.entries(expected)) {
    expect(regs.find((r) => r.id === Number(reg))?.value, `reg $${Number(reg).toString(16)}`).toBe(value);
  }
}

function expectMemoryPortState(
  wasm: ZxNextWasmV2Machine,
  rom: number,
  bank: number,
  partitions: number[],
  labels: string[]
): void {
  expect(wasm.getSelectedRomPage()).toBe(rom);
  expect(wasm.getSelectedRamBank()).toBe(bank);
  expect(wasm.getCurrentPartitions()).toEqual(partitions);
  expect(wasm.getCurrentPartitionLabels()).toEqual(labels);
}

function expectLastWrite(wasm: ZxNextWasmV2Machine, port: number, value: number): void {
  expect(wasm.lastIoWritePort).toBe(port);
  expect(wasm.lastIoWriteValue).toBe(value);
}

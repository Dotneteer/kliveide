import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

/**
 * CALL and RST push the return address as two bytes: the high byte, then the low byte. The data bus
 * is 8 bits wide, so the low byte's write cycle carries `PC & $FF` - never the whole 16-bit PC.
 *
 * Found by the Cambridge Z88 WASM migration's IDE parity test (Step 11 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`): `callCore` and `rstCore` passed the whole PC, so the
 * CPU panel's "last memory write value" showed a 16-bit number after a CALL, and a memory handler that
 * looks at the value (a Z88 flash card) saw one. The memory array itself stored the right byte.
 */
describe("Z80 CALL and RST write bytes", () => {
  it("CALL: the pushed bytes, and the last write value, are bytes", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    // --- At $1234: CALL $2000 - the return address is $1237
    m.initCode([0xcd, 0x00, 0x20], 0x1234, 0x1234);
    m.cpu.sp = 0x8000;
    m.run();

    const writes = m.memoryAccessLog.filter((op) => op.isWrite);
    expect(writes.map((op) => [op.address, op.value])).toEqual([
      [0x7fff, 0x12],
      [0x7ffe, 0x37]
    ]);
    expect(m.cpu.lastMemoryWriteValue).toBe(0x37);
    expect(m.cpu.pc).toBe(0x2000);
  });

  it("RST: the pushed bytes, and the last write value, are bytes", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    // --- At $1234: RST $38 - the return address is $1235
    m.initCode([0xff], 0x1234, 0x1234);
    m.cpu.sp = 0x8000;
    m.run();

    const writes = m.memoryAccessLog.filter((op) => op.isWrite);
    expect(writes.map((op) => [op.address, op.value])).toEqual([
      [0x7fff, 0x12],
      [0x7ffe, 0x35]
    ]);
    expect(m.cpu.lastMemoryWriteValue).toBe(0x35);
    expect(m.cpu.pc).toBe(0x0038);
  });
});

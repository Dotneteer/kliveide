import { describe, expect, it } from "vitest";

import { RunMode, Z80TestMachine } from "./z80/test-z80";

describe("Z80 WASM test harness smoke tests", () => {
  it("executes a copied-test-style single-byte instruction", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);

    m.initCode([0x00]);
    m.run();

    expect(m.cpu.pc).toBe(0x0001);
    expect(m.cpu.tacts).toBe(4);
    m.shouldKeepRegisters();
    m.shouldKeepMemory();
  });

  it("exposes the register and memory surface used by literal tests", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);

    m.initCode([0x01, 0x34, 0x12]);
    m.cpu.af = 0xabcd;
    m.memory[0x2000] = 0x5a;
    m.run();

    expect(m.cpu.bc).toBe(0x1234);
    expect(m.cpu.a).toBe(0xab);
    expect(m.cpu.f).toBe(0xcd);
    expect(m.memory[0x2000]).toBe(0x5a);
    m.shouldKeepRegisters("BC");
    m.shouldKeepMemory();
  });
});

import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 extended ops 00-3f", () => {
  for (let opCode = 0x00; opCode <= 0x3f; opCode++) {
    it(`0x${opCode.toString(16).padStart(2, "0")}: nop`, () => {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      m.initCode([
        0xed,
        opCode
      ]);

      // --- Act
      m.run();

      // --- Assert
      const cpu = m.cpu;
      m.shouldKeepRegisters();
      m.shouldKeepMemory();

      expect(cpu.pc).toBe(0x0002);
      expect(cpu.tacts).toBe(8);
    });
  }
});

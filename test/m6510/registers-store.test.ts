import { describe, expect, it } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("M6510 Registers store instructions", () => {
  // STA <zp>: 0x85
  it("STA <zp> works", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0x85, 0x34], 0x1000, 0x1000);
    machine.cpu.a = 0x12; // Set Accumulator to 0x12

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x34)).toBe(0x12);
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(3);
  });

  // STA <zp>,X: 0x95
  it("STA <zp>,X works", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);

    machine.initCode([0x95, 0x34], 0x1000, 0x1000);
    machine.cpu.a = 0x12; // Set Accumulator to 0x12
    machine.cpu.x = 0x02; // Set X Register to 0x02

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x36)).toBe(0x12); // Effective address is 0x34 + 0x02 = 0x36
    expect(machine.cpu.pc).toBe(0x1002);

    expect(machine.cpu.tacts).toBe(4);
  });
  
});

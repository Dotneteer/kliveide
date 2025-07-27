import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("M6510 Transfer Debug", () => {
  it("TXA simple debug test", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x8a], 0x1000, 0x1000); // TXA
    
    console.log("Before setting X:", machine.cpu.x, machine.cpu.a);
    machine.cpu.x = 0x42;
    machine.cpu.a = 0x00;
    console.log("After setting X:", machine.cpu.x, machine.cpu.a);

    // --- Act
    machine.run();
    console.log("After run:", machine.cpu.x, machine.cpu.a);

    // --- Assert
    expect(machine.cpu.a).toBe(0x42);
  });
});

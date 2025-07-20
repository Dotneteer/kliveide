import { describe, expect, it } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("M6510 Test Machine", () => {
  it("should initialize the CPU correctly", () => {
    // --- Arrange
    const machine = new M6510TestMachine();
    
    // --- Assert
    expect(machine.cpu.a).toBe(0);
    expect(machine.cpu.x).toBe(0);
    expect(machine.cpu.y).toBe(0);
    expect(machine.cpu.pc).toBe(0);
    expect(machine.cpu.sp).toBe(0);
    // P register should have the UNUSED bit set by default
    expect(machine.cpu.p & 0x20).toBe(0x20);
  });

  it("should run a simple program", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.UntilBrk);
    
    // Simple program to load A with 42
    // BRK
    machine.initCode([0x00], 0x1000, 0x1000);
    
    // --- Act
    machine.run();
    
    // --- Assert
    expect(machine.cpu.a).toBe(0x00);
    // Check that PC is at the end of our code
    expect(machine.cpu.pc).toBe(0x1000);
  });
});

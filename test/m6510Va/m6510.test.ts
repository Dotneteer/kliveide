import { describe, expect, it } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

describe("M6510 Test Machine", () => {
  it("should initialize the CPU correctly", () => {
    // --- Arrange
    const machine = new M6510VaTestMachine();

    // --- Assert
    expect(machine.cpu.a).toBe(0);
    expect(machine.cpu.x).toBe(0);
    expect(machine.cpu.y).toBe(0);
    expect(machine.cpu.pc).toBe(0);
    expect(machine.cpu.sp).toBe(0);
    // P register should have the UNUSED bit set by default
    expect(machine.cpu.p & 0x20).toBe(0x20);
  });
});

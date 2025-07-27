import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("RRA Debug", () => {
  it("Should debug RRA (zp,X) - flags check", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x63, 0x80], 0x1000, 0x1000); // RRA (0x80,X)
    machine.cpu.x = 0x10; // X = 0x10
    machine.cpu.a = 0x05; // A = 0x05

    // Set up indirect addressing: 0x80 + 0x10 = 0x90 (zero page)
    machine.writeMemory(0x90, 0x20); // Low byte of target address
    machine.writeMemory(0x91, 0x30); // High byte of target address
    machine.writeMemory(0x3020, 0x82); // Target memory = 0x82 (10000010)

    machine.cpu.p = 0x01; // Set carry flag

    // --- Act
    machine.run();

    // --- Assert flags one by one
    const afterMemory = machine.readMemory(0x3020);
    const afterA = machine.cpu.a;
    
    // Verify basics first
    expect(afterMemory).toBe(0xC1);
    expect(afterA).toBe(0xC6);
    
    // Now check flags
    const carryFlag = machine.cpu.isCFlagSet();
    const zeroFlag = machine.cpu.isZFlagSet();
    const negativeFlag = machine.cpu.isNFlagSet();
    const overflowFlag = machine.cpu.isVFlagSet();
    
    // Test carry flag
    // ADC: 0x05 + 0xC1 + 0 = 0xC6 (no carry out)
    expect(carryFlag).toBe(false);
    
    // Test zero flag
    // Result 0xC6 is not zero
    expect(zeroFlag).toBe(false);
    
    // Test negative flag
    // Result 0xC6 has bit 7 set (1100 0110)
    expect(negativeFlag).toBe(true);
    
    // Test overflow flag
    // ADC: 0x05 (positive) + 0xC1 (negative) = 0xC6 (negative)
    // This should be overflow: positive + negative = negative, but that's not overflow
    // Actually: 0x05 is positive, 0xC1 is negative in signed arithmetic
    // 0x05 + 0xC1 = 5 + (-63) = -58 = 0xC6 (in 2's complement)
    // No overflow because pos + neg cannot overflow
    expect(overflowFlag).toBe(false);
  });
});

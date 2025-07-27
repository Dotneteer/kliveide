import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

/**
 * Tests for the SAX (Store A AND X) undocumented instruction
 *
 * SAX performs A AND X and stores the result to memory.
 * It does not affect any flags.
 *
 * Opcodes:
 * - 0x83: SAX (zp,X) - Indexed Indirect
 * - 0x87: SAX zp - Zero Page
 * - 0x8F: SAX abs - Absolute
 * - 0x97: SAX zp,Y - Zero Page,Y
 */
describe("M6510 Undocumented Instructions - SAX", () => {
  it("Should store A AND X using indexed indirect addressing", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x83, 0x10], 0x1000, 0x1000); // SAX ($10,X)
    machine.cpu.a = 0x7F;
    machine.cpu.x = 0x3C;

    // Set up indirect addressing: 0x10 + 0x3C = 0x4C (zero page)
    machine.writeMemory(0x4C, 0x00); // Low byte of target address
    machine.writeMemory(0x4D, 0x30); // High byte of target address -> $3000

    const initialFlags = machine.cpu.p; // Store initial flags

    // --- Act
    machine.run();

    // --- Assert
    // SAX: A AND X = 0x7F AND 0x3C = 0x3C stored at $3000
    expect(machine.readMemory(0x3000)).toBe(0x3C);
    expect(machine.cpu.p).toBe(initialFlags); // Flags should be unchanged
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(6); // 2 + 1 + 1 + 1 + 1 = 6 cycles
  });

  it("Should handle zero page wrap-around for address calculation", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x83, 0x00], 0x1000, 0x1000); // SAX ($00,X)
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0xFF;

    // Address table wraps around: $00+$FF = $FF (in zero page)
    machine.writeMemory(0xFF, 0x50); // Low byte
    machine.writeMemory(0x00, 0x25); // High byte (wraps) -> $2550

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x2550)).toBe(0xFF); // A AND X = $FF
  });

  it("Should store A AND X to zero page address", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x87, 0x80], 0x1000, 0x1000); // SAX $80
    machine.cpu.a = 0xF0;
    machine.cpu.x = 0x0F;

    const initialFlags = machine.cpu.p;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x80)).toBe(0x00); // F0 AND 0F = 00
    expect(machine.cpu.p).toBe(initialFlags);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(3); // 2 + 1 = 3 cycles
  });

  it("Should work with all bits set", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x87, 0x42], 0x1000, 0x1000); // SAX $42
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0xFF;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x42)).toBe(0xFF);
  });

  it("Should store A AND X to absolute address", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x8F, 0x00, 0x40], 0x1000, 0x1000); // SAX $4000
    machine.cpu.a = 0xAA;
    machine.cpu.x = 0x55;

    const initialFlags = machine.cpu.p;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x4000)).toBe(0x00); // AA AND 55 = 00
    expect(machine.cpu.p).toBe(initialFlags);
    expect(machine.cpu.pc).toBe(0x1003);
    expect(machine.cpu.tacts).toBe(4); // 2 + 2 = 4 cycles
  });

  it("Should handle alternating bit patterns", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x8F, 0x34, 0x12], 0x1000, 0x1000); // SAX $1234
    machine.cpu.a = 0x55; // 01010101
    machine.cpu.x = 0xAA; // 10101010

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x1234)).toBe(0x00); // No bits overlap
  });

  it("Should store A AND X to zero page with Y offset", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x97, 0x20], 0x1000, 0x1000); // SAX $20,Y
    machine.cpu.a = 0x3F;
    machine.cpu.x = 0x1F;
    machine.cpu.y = 0x05;

    const initialFlags = machine.cpu.p;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x25)).toBe(0x1F); // 3F AND 1F = 1F, stored at $20+$05=$25
    expect(machine.cpu.p).toBe(initialFlags);
    expect(machine.cpu.pc).toBe(0x1002);
    expect(machine.cpu.tacts).toBe(4); // 2 + 1 + 1 = 4 cycles
  });

  it("Should wrap around in zero page when Y causes overflow", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x97, 0xF8], 0x1000, 0x1000); // SAX $F8,Y
    machine.cpu.a = 0x80;
    machine.cpu.x = 0x81;
    machine.cpu.y = 0x10;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x08)).toBe(0x80); // 80 AND 81 = 80, stored at $F8+$10=$08 (wrapped)
  });

  it("Should handle A=0 AND X=anything", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x87, 0x50], 0x1000, 0x1000); // SAX $50
    machine.cpu.a = 0x00;
    machine.cpu.x = 0xFF;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x50)).toBe(0x00);
  });

  it("Should handle A=anything AND X=0", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x87, 0x60], 0x1000, 0x1000); // SAX $60
    machine.cpu.a = 0xFF;
    machine.cpu.x = 0x00;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x60)).toBe(0x00);
  });

  it("Should not affect any flags regardless of result", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x87, 0x70], 0x1000, 0x1000); // SAX $70
    machine.cpu.a = 0x7F;
    machine.cpu.x = 0x80;
    
    // Set all flags
    machine.cpu.p = 0xFF; // Set all flags
    const initialFlags = machine.cpu.p;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.readMemory(0x70)).toBe(0x00); // Result is zero
    expect(machine.cpu.p).toBe(initialFlags); // But flags unchanged
  });

  it("Should preserve registers except for PC", () => {
    // --- Arrange
    const machine = new M6510TestMachine(RunMode.OneInstruction);
    machine.initCode([0x8F, 0x00, 0x50], 0x1000, 0x1000); // SAX $5000
    machine.cpu.a = 0x42;
    machine.cpu.x = 0x24;
    machine.cpu.y = 0x12;
    machine.cpu.sp = 0xFF;

    // --- Act
    machine.run();

    // --- Assert
    expect(machine.cpu.a).toBe(0x42);
    expect(machine.cpu.x).toBe(0x24);
    expect(machine.cpu.y).toBe(0x12);
    expect(machine.cpu.sp).toBe(0xFF);
    expect(machine.cpu.pc).toBe(0x1003);
  });

  describe("SAX bit pattern verification", () => {
    const testCases = [
      { a: 0x00, x: 0x00, expected: 0x00, desc: "zero AND zero" },
      { a: 0xFF, x: 0xFF, expected: 0xFF, desc: "all bits AND all bits" },
      { a: 0xF0, x: 0x0F, expected: 0x00, desc: "high nibble AND low nibble" },
      { a: 0xAA, x: 0x55, expected: 0x00, desc: "alternating patterns" },
      { a: 0x80, x: 0x80, expected: 0x80, desc: "same high bit" },
      { a: 0x01, x: 0x01, expected: 0x01, desc: "same low bit" },
      { a: 0x7F, x: 0x80, expected: 0x00, desc: "positive AND negative sign bits" },
      { a: 0x33, x: 0xCC, expected: 0x00, desc: "complementary patterns" },
    ];

    testCases.forEach(({ a, x, expected, desc }) => {
      it(`should correctly compute ${desc} (A=$${a.toString(16).padStart(2, '0').toUpperCase()}, X=$${x.toString(16).padStart(2, '0').toUpperCase()})`, () => {
        // --- Arrange
        const machine = new M6510TestMachine(RunMode.OneInstruction);
        machine.initCode([0x87, 0x80], 0x1000, 0x1000); // SAX $80
        machine.cpu.a = a;
        machine.cpu.x = x;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.readMemory(0x80)).toBe(expected);
      });
    });
  });
});

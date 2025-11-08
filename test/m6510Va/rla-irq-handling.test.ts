import { describe, it, expect, beforeEach } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";
import { FlagSetMask6510 } from "../../src/emu/abstractions/FlagSetMask6510";

describe.skip("M6510 - RLA Interrupt Handling", () => {
  let machine: M6510VaTestMachine;

  beforeEach(() => {
    machine = new M6510VaTestMachine(RunMode.UntilBrk);
  });

  describe("RLA Absolute,X (0x3F) - Read-Modify-Write Interrupt Timing", () => {
    it("clock cycle is correct when IRQ occurs before RLA $1000,X", () => {
      // --- Arrange
      const testMachine = new M6510VaTestMachine(RunMode.UntilBrk);

      // Program: NOP, then RLA $1000,X to test interrupt before RLA, then BRK to stop
      const program = [
        0xea, // $8000: NOP (2 cycles)
        0x3f,
        0x00,
        0x10, // $8001: RLA $1000,X (7 cycles) --> IRQ before: 7 + 11 cycles
        0xea, // $8004: NOP (2 cycles)
        0x00 // $8005: BRK (stops execution)
      ];

      testMachine.initCode(program, 0x8000, 0x8000);

      // Set up IRQ handler
      testMachine.setupIrqHandler(0x9100, [
        0xa9,
        0x77, // LDA #$77 - marker (2 cycles)
        0x8d,
        0x00,
        0xd0, // STA $D000 - store marker (3 cycles)
        0x40 // RTI (6 cycles)
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x8000;
      testMachine.cpu.sp = 0xff;
      testMachine.cpu.x = 0x05; // No page boundary crossing
      testMachine.cpu.a = 0x0F; // Accumulator for AND operation
      testMachine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set initial memory value at target address
      testMachine.writeMemory(0x1005, 0x42); // 0x42 = 01000010
      testMachine.writeMemory(0xd000, 0x00); // Clear marker

      // Trigger IRQ after NOP completes (at tact 2), before RLA starts
      testMachine.setupInterruptWindow("irq", 1, 3);

      // --- Act: Execute until BRK is reached
      testMachine.run();

      // --- Assert: Verify interrupt timing and RMW completion

      // Verify we stopped at BRK
      expect(testMachine.cpu.pc).toBe(0x8005); // At the BRK instruction

      // Verify IRQ handler executed
      expect(testMachine.readMemory(0xd000)).toBe(0x77); // IRQ marker should be set
      expect(testMachine.cpu.irqRequested).toBe(false); // IRQ should be cleared

      // Verify the RMW operation completed correctly
      expect(testMachine.readMemory(0x1005)).toBe(0x84); // Memory: 0x42 << 1 = 0x84

      // Verify interrupt occurred at expected tact
      expect(testMachine.cpu.interruptedInstructionStartTact).toBe(2);

      // Verify clock cycles
      expect(testMachine.cpu.tacts).toBe(30); // Based on pattern from other RMW tests

      // Stack should be restored
      expect(testMachine.cpu.sp).toBe(0xff);
      expect(testMachine.cpu.isIFlagSet()).toBe(false); // I flag restored
    });

    it("clock cycle is correct when IRQ occurs during RLA $1000,X", () => {
      // --- Arrange
      const testMachine = new M6510VaTestMachine(RunMode.UntilBrk);

      // Program: NOP, then RLA $1000,X to test interrupt during RLA, then BRK to stop
      const program = [
        0xea, // $8000: NOP (2 cycles)
        0x3f,
        0x00,
        0x10, // $8001: RLA $1000,X (7 cycles) --> IRQ during: 7 + 11 cycles
        0xea, // $8004: NOP (2 cycles)
        0x00 // $8005: BRK (stops execution)
      ];

      testMachine.initCode(program, 0x8000, 0x8000);

      // Set up IRQ handler
      testMachine.setupIrqHandler(0x9100, [
        0xa9,
        0x88, // LDA #$88 - marker (2 cycles)
        0x8d,
        0x00,
        0xd0, // STA $D000 - store marker (3 cycles)
        0x40 // RTI (6 cycles)
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x8000;
      testMachine.cpu.sp = 0xff;
      testMachine.cpu.x = 0x05; // No page boundary crossing
      testMachine.cpu.a = 0x0F; // Accumulator for AND operation
      testMachine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set initial memory value at target address
      testMachine.writeMemory(0x1005, 0x42); // 0x42 = 01000010
      testMachine.writeMemory(0xd000, 0x00); // Clear marker

      // Trigger IRQ during RLA execution
      testMachine.setupInterruptWindow("irq", 3, 10);

      // --- Act: Execute until BRK is reached
      testMachine.run();

      // --- Assert: Verify interrupt timing and RMW completion

      // Verify we stopped at BRK
      expect(testMachine.cpu.pc).toBe(0x8005); // At the BRK instruction

      // Verify IRQ handler executed
      expect(testMachine.readMemory(0xd000)).toBe(0x88); // IRQ marker should be set
      expect(testMachine.cpu.irqRequested).toBe(false); // IRQ should be cleared

      // Verify the RMW operation completed correctly
      expect(testMachine.readMemory(0x1005)).toBe(0x84); // Memory: 0x42 << 1 = 0x84

      // Verify interrupt occurred during RLA execution
      expect(testMachine.cpu.interruptedInstructionStartTact).toBe(9);

      // Verify clock cycles
      expect(testMachine.cpu.tacts).toBe(30); // Based on pattern from other RMW tests

      // Stack should be restored
      expect(testMachine.cpu.sp).toBe(0xff);
      expect(testMachine.cpu.isIFlagSet()).toBe(false); // I flag restored
    });
  });

  describe("RLA Zero Page (0x27) - Read-Modify-Write Interrupt Timing", () => {
    it("clock cycle is correct when IRQ occurs before RLA $80", () => {
      // --- Arrange
      const testMachine = new M6510VaTestMachine(RunMode.UntilBrk);

      // Program: NOP, then RLA $80 to test interrupt before RLA, then BRK to stop
      const program = [
        0xea, // $8000: NOP (2 cycles)
        0x27,
        0x80, // $8001: RLA $80 (5 cycles) --> IRQ before: 5 + 11 cycles
        0xea, // $8003: NOP (2 cycles)
        0x00 // $8004: BRK (stops execution)
      ];

      testMachine.initCode(program, 0x8000, 0x8000);

      // Set up IRQ handler
      testMachine.setupIrqHandler(0x9100, [
        0xa9,
        0x99, // LDA #$99 - marker (2 cycles)
        0x8d,
        0x00,
        0xd0, // STA $D000 - store marker (4 cycles)
        0x40 // RTI (6 cycles)
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x8000;
      testMachine.cpu.sp = 0xff;
      testMachine.cpu.a = 0x0F; // Accumulator for AND operation
      testMachine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set initial memory value at target address
      testMachine.writeMemory(0x80, 0x42); // 0x42 = 01000010
      testMachine.writeMemory(0xd000, 0x00); // Clear marker

      // Trigger IRQ after NOP completes (at tact 2), before RLA starts
      testMachine.setupInterruptWindow("irq", 1, 3);

      // --- Act: Execute until BRK is reached
      testMachine.run();

      // --- Assert: Verify interrupt timing and RMW completion

      // Verify we stopped at BRK
      expect(testMachine.cpu.pc).toBe(0x8004); // At the BRK instruction

      // Verify IRQ handler executed
      expect(testMachine.readMemory(0xd000)).toBe(0x99); // IRQ marker should be set
      expect(testMachine.cpu.irqRequested).toBe(false); // IRQ should be cleared

      // Verify the RMW operation completed correctly
      expect(testMachine.readMemory(0x80)).toBe(0x84); // Memory: 0x42 << 1 = 0x84

      // Verify interrupt occurred at expected tact
      expect(testMachine.cpu.interruptedInstructionStartTact).toBe(2);

      // Verify clock cycles: Follow the same pattern as working test
      expect(testMachine.cpu.tacts).toBe(28); // Based on Zero Page pattern

      // Stack should be restored
      expect(testMachine.cpu.sp).toBe(0xff);
      expect(testMachine.cpu.isIFlagSet()).toBe(false); // I flag restored
    });

    it("clock cycle is correct when IRQ occurs during RLA $90", () => {
      // --- Arrange
      const testMachine = new M6510VaTestMachine(RunMode.UntilBrk);

      // Program: NOP, then RLA $90 to test interrupt during RLA, then BRK to stop
      const program = [
        0xea, // $8000: NOP (2 cycles)
        0x27,
        0x90, // $8001: RLA $90 (5 cycles) --> IRQ during: 5 + 11 cycles
        0xea, // $8003: NOP (2 cycles)
        0x00 // $8004: BRK (stops execution)
      ];

      testMachine.initCode(program, 0x8000, 0x8000);

      // Set up IRQ handler
      testMachine.setupIrqHandler(0x9100, [
        0xa9,
        0xaa, // LDA #$AA - marker (2 cycles)
        0x8d,
        0x01,
        0xd0, // STA $D001 - store marker (4 cycles)
        0x40 // RTI (6 cycles)
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x8000;
      testMachine.cpu.sp = 0xff;
      testMachine.cpu.a = 0x0F; // Accumulator for AND operation
      testMachine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set initial memory value at target address
      testMachine.writeMemory(0x90, 0x42); // 0x42 = 01000010
      testMachine.writeMemory(0xd001, 0x00); // Clear marker

      // Trigger IRQ during RLA execution
      testMachine.setupInterruptWindow("irq", 3, 10);

      // --- Act: Execute until BRK is reached
      testMachine.run();

      // --- Assert: Verify interrupt timing and RMW completion

      // Verify we stopped at BRK
      expect(testMachine.cpu.pc).toBe(0x8004); // At the BRK instruction

      // Verify IRQ handler executed
      expect(testMachine.readMemory(0xd001)).toBe(0xaa); // IRQ marker should be set
      expect(testMachine.cpu.irqRequested).toBe(false); // IRQ should be cleared

      // Verify the RMW operation completed correctly
      expect(testMachine.readMemory(0x90)).toBe(0x84); // Memory: 0x42 << 1 = 0x84

      // Verify interrupt occurred during RLA execution
      expect(testMachine.cpu.interruptedInstructionStartTact).toBe(7);

      // Stack should be restored
      expect(testMachine.cpu.sp).toBe(0xff);
      expect(testMachine.cpu.isIFlagSet()).toBe(false); // I flag restored
    });
  });

  describe("RLA Absolute (0x2F) - Read-Modify-Write Interrupt Timing", () => {
    it("clock cycle is correct when IRQ occurs before RLA $2000", () => {
      // --- Arrange
      const testMachine = new M6510VaTestMachine(RunMode.UntilBrk);

      // Program: NOP, then RLA $2000 to test interrupt before RLA, then BRK to stop
      const program = [
        0xea, // $8000: NOP (2 cycles)
        0x2f,
        0x00,
        0x20, // $8001: RLA $2000 (6 cycles) --> IRQ before: 6 + 11 cycles
        0xea, // $8004: NOP (2 cycles)
        0x00 // $8005: BRK (stops execution)
      ];

      testMachine.initCode(program, 0x8000, 0x8000);

      // Set up IRQ handler
      testMachine.setupIrqHandler(0x9100, [
        0xa9,
        0xbb, // LDA #$BB - marker (2 cycles)
        0x8d,
        0x02,
        0xd0, // STA $D002 - store marker (4 cycles)
        0x40 // RTI (6 cycles)
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x8000;
      testMachine.cpu.sp = 0xff;
      testMachine.cpu.a = 0x0F; // Accumulator for AND operation
      testMachine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set initial memory value at target address
      testMachine.writeMemory(0x2000, 0x42); // 0x42 = 01000010
      testMachine.writeMemory(0xd002, 0x00); // Clear marker

      // Trigger IRQ after NOP completes (at tact 2), before RLA starts
      testMachine.setupInterruptWindow("irq", 1, 3);

      // --- Act: Execute until BRK is reached
      testMachine.run();

      // --- Assert: Verify interrupt timing and RMW completion

      // Verify we stopped at BRK
      expect(testMachine.cpu.pc).toBe(0x8005); // At the BRK instruction

      // Verify IRQ handler executed
      expect(testMachine.readMemory(0xd002)).toBe(0xbb); // IRQ marker should be set
      expect(testMachine.cpu.irqRequested).toBe(false); // IRQ should be cleared

      // Verify the RMW operation completed correctly
      expect(testMachine.readMemory(0x2000)).toBe(0x84); // Memory: 0x42 << 1 = 0x84

      // Verify interrupt occurred at expected tact
      expect(testMachine.cpu.interruptedInstructionStartTact).toBe(2);

      // Verify clock cycles: Follow the same pattern as working test
      expect(testMachine.cpu.tacts).toBe(29); // Based on Absolute pattern

      // Stack should be restored
      expect(testMachine.cpu.sp).toBe(0xff);
      expect(testMachine.cpu.isIFlagSet()).toBe(false); // I flag restored
    });

    it("clock cycle is correct when IRQ occurs during RLA $3000", () => {
      // --- Arrange
      const testMachine = new M6510VaTestMachine(RunMode.UntilBrk);

      // Program: NOP, then RLA $3000 to test interrupt during RLA, then BRK to stop
      const program = [
        0xea, // $8000: NOP (2 cycles)
        0x2f,
        0x00,
        0x30, // $8001: RLA $3000 (6 cycles) --> IRQ during: 6 + 11 cycles
        0xea, // $8004: NOP (2 cycles)
        0x00 // $8005: BRK (stops execution)
      ];

      testMachine.initCode(program, 0x8000, 0x8000);

      // Set up IRQ handler
      testMachine.setupIrqHandler(0x9100, [
        0xa9,
        0xcc, // LDA #$CC - marker (2 cycles)
        0x8d,
        0x03,
        0xd0, // STA $D003 - store marker (4 cycles)
        0x40 // RTI (6 cycles)
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x8000;
      testMachine.cpu.sp = 0xff;
      testMachine.cpu.a = 0x0F; // Accumulator for AND operation
      testMachine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set initial memory value at target address
      testMachine.writeMemory(0x3000, 0x42); // 0x42 = 01000010
      testMachine.writeMemory(0xd003, 0x00); // Clear marker

      // Trigger IRQ during RLA execution
      testMachine.setupInterruptWindow("irq", 3, 10);

      // --- Act: Execute until BRK is reached
      testMachine.run();

      // --- Assert: Verify interrupt timing and RMW completion

      // Verify we stopped at BRK
      expect(testMachine.cpu.pc).toBe(0x8005); // At the BRK instruction

      // Verify IRQ handler executed
      expect(testMachine.readMemory(0xd003)).toBe(0xcc); // IRQ marker should be set
      expect(testMachine.cpu.irqRequested).toBe(false); // IRQ should be cleared

      // Verify the RMW operation completed correctly
      expect(testMachine.readMemory(0x3000)).toBe(0x84); // Memory: 0x42 << 1 = 0x84

      // Verify interrupt occurred during RLA execution
      expect(testMachine.cpu.interruptedInstructionStartTact).toBe(8);

      // Stack should be restored
      expect(testMachine.cpu.sp).toBe(0xff);
      expect(testMachine.cpu.isIFlagSet()).toBe(false); // I flag restored
    });
  });

  describe("RLA Zero Page,X (0x37) - Read-Modify-Write Interrupt Timing", () => {
    it("clock cycle is correct when IRQ occurs before RLA $80,X", () => {
      // --- Arrange
      const testMachine = new M6510VaTestMachine(RunMode.UntilBrk);

      // Program: NOP, then RLA $80,X to test interrupt before RLA, then BRK to stop
      const program = [
        0xea, // $8000: NOP (2 cycles)
        0x37,
        0x80, // $8001: RLA $80,X (6 cycles) --> IRQ before: 6 + 11 cycles
        0xea, // $8003: NOP (2 cycles)
        0x00 // $8004: BRK (stops execution)
      ];

      testMachine.initCode(program, 0x8000, 0x8000);

      // Set up IRQ handler
      testMachine.setupIrqHandler(0x9100, [
        0xa9,
        0xdd, // LDA #$DD - marker (2 cycles)
        0x8d,
        0x04,
        0xd0, // STA $D004 - store marker (4 cycles)
        0x40 // RTI (6 cycles)
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x8000;
      testMachine.cpu.sp = 0xff;
      testMachine.cpu.x = 0x05; // Zero page wrapping: $80 + $05 = $85
      testMachine.cpu.a = 0x0F; // Accumulator for AND operation
      testMachine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set initial memory value at target address
      testMachine.writeMemory(0x85, 0x42); // 0x42 = 01000010
      testMachine.writeMemory(0xd004, 0x00); // Clear marker

      // Trigger IRQ after NOP completes (at tact 2), before RLA starts
      testMachine.setupInterruptWindow("irq", 1, 3);

      // --- Act: Execute until BRK is reached
      testMachine.run();

      // --- Assert: Verify interrupt timing and RMW completion

      // Verify we stopped at BRK
      expect(testMachine.cpu.pc).toBe(0x8004); // At the BRK instruction

      // Verify IRQ handler executed
      expect(testMachine.readMemory(0xd004)).toBe(0xdd); // IRQ marker should be set
      expect(testMachine.cpu.irqRequested).toBe(false); // IRQ should be cleared

      // Verify the RMW operation completed correctly
      expect(testMachine.readMemory(0x85)).toBe(0x84); // Memory: 0x42 << 1 = 0x84

      // Verify interrupt occurred at expected tact
      expect(testMachine.cpu.interruptedInstructionStartTact).toBe(2);

      // Verify clock cycles: Follow the same pattern as working test
      expect(testMachine.cpu.tacts).toBe(29); // Based on Zero Page,X pattern

      // Stack should be restored
      expect(testMachine.cpu.sp).toBe(0xff);
      expect(testMachine.cpu.isIFlagSet()).toBe(false); // I flag restored
    });

    it("clock cycle is correct when IRQ occurs during RLA $F0,X (with zero page wrapping)", () => {
      // --- Arrange
      const testMachine = new M6510VaTestMachine(RunMode.UntilBrk);

      // Program: NOP, then RLA $F0,X to test interrupt during RLA with zero page wrapping, then BRK to stop
      const program = [
        0xea, // $8000: NOP (2 cycles)
        0x37,
        0xf0, // $8001: RLA $F0,X (6 cycles) --> IRQ during: 6 + 11 cycles
        0xea, // $8003: NOP (2 cycles)
        0x00 // $8004: BRK (stops execution)
      ];

      testMachine.initCode(program, 0x8000, 0x8000);

      // Set up IRQ handler
      testMachine.setupIrqHandler(0x9100, [
        0xa9,
        0xee, // LDA #$EE - marker (2 cycles)
        0x8d,
        0x05,
        0xd0, // STA $D005 - store marker (4 cycles)
        0x40 // RTI (6 cycles)
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x8000;
      testMachine.cpu.sp = 0xff;
      testMachine.cpu.x = 0x20; // Zero page wrapping: ($F0 + $20) & $FF = $10
      testMachine.cpu.a = 0x0F; // Accumulator for AND operation
      testMachine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set initial memory value at target address
      testMachine.writeMemory(0x10, 0x42); // 0x42 = 01000010
      testMachine.writeMemory(0xd005, 0x00); // Clear marker

      // Trigger IRQ during RLA execution
      testMachine.setupInterruptWindow("irq", 3, 10);

      // --- Act: Execute until BRK is reached
      testMachine.run();

      // --- Assert: Verify interrupt timing and RMW completion

      // Verify we stopped at BRK
      expect(testMachine.cpu.pc).toBe(0x8004); // At the BRK instruction

      // Verify IRQ handler executed
      expect(testMachine.readMemory(0xd005)).toBe(0xee); // IRQ marker should be set
      expect(testMachine.cpu.irqRequested).toBe(false); // IRQ should be cleared

      // Verify the RMW operation completed correctly with zero page wrapping
      expect(testMachine.readMemory(0x10)).toBe(0x84); // Memory: 0x42 << 1 = 0x84

      // Verify interrupt occurred during RLA execution
      expect(testMachine.cpu.interruptedInstructionStartTact).toBe(8);

      // Stack should be restored
      expect(testMachine.cpu.sp).toBe(0xff);
      expect(testMachine.cpu.isIFlagSet()).toBe(false); // I flag restored
    });
  });
});

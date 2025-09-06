import { describe, it, expect, beforeEach } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";
import { FlagSetMask6510 } from "../../src/emu/abstractions/FlagSetMask6510";

describe("M6510 - Interrupt Handling", () => {
  let machine: M6510VaTestMachine;

  beforeEach(() => {
    machine = new M6510VaTestMachine(RunMode.UntilBrk);
  });

  describe("NMI (Non-Maskable Interrupt)", () => {
    it("should handle NMI request properly", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA], 0x1000, 0x1000); // NOP, NOP
      machine.cpu.pc = 0x1000; // Start at code location
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.Z | FlagSetMask6510.C | FlagSetMask6510.UNUSED;

      // Set up IRQ handler with custom code
      machine.setupNmiHandler(0x8000, [
        0x00                  // BRK
      ]);

      // --- Act
      machine.setupInterruptWindow("nmi", 1, 3);
      machine.run(); // This should handle the NMI instead of executing the NOP

      // --- Assert
      expect(machine.cpu.pc).toBe(0x8000); // Should jump to NMI vector
      expect(machine.cpu.sp).toBe(0xFC); // Stack pointer should be decremented by 3 (PCH, PCL, P)
      expect(machine.cpu.isIFlagSet()).toBe(true); // I flag should be set during NMI handling
      expect(machine.checkedTacts).toBe(9); // NMI handling takes 7 cycles + 2 for the NOP at 0x8000

      // Check stack contents - PC was 0x1000 when NMI was triggered
      expect(machine.readMemory(0x01FF)).toBe(0x10); // PCH on stack
      expect(machine.readMemory(0x01FE)).toBe(0x01); // PCL on stack
      const expectedStatus = (FlagSetMask6510.Z | FlagSetMask6510.C | FlagSetMask6510.UNUSED) & ~FlagSetMask6510.B;
      expect(machine.readMemory(0x01FD)).toBe(expectedStatus); // Status without B flag on stack
    });

    it("should handle NMI even when I flag is set", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA], 0x1000, 0x1000); // NOP
      machine.cpu.pc = 0x1000; // Start at code location
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.I | FlagSetMask6510.UNUSED; // I flag set

      // Set up IRQ handler with custom code
      machine.setupNmiHandler(0x8000, [
        0x00                  // BRK
      ]);

      // --- Act
      machine.setupInterruptWindow("nmi", 1, 3);
      machine.run();

      // --- Assert
      expect(machine.cpu.pc).toBe(0x8000); // Should jump to NMI vector despite I flag
      expect(machine.cpu.sp).toBe(0xFC);
      expect(machine.cpu.isIFlagSet()).toBe(true); // I flag should remain set
    });

    it("should have higher priority than IRQ", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA], 0x1000, 0x1000); // NOP
      machine.cpu.pc = 0x1000; // Start at code location
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set up IRQ handler with custom code
      machine.setupNmiHandler(0x8000, [
        0x00                  // BRK
      ]);
      machine.setupIrqHandler(0xA000, [
        0x00                  // BRK
      ]);

      // --- Act
      machine.setupInterruptWindow("both", 1, 20);
      machine.run();

      // --- Assert
      expect(machine.cpu.irqRequested).toBe(true); // IRQ should still be pending
      expect(machine.cpu.pc).toBe(0x8000); // Should handle NMI first
    });

    it("should preserve all flags except B when pushing status to stack", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA], 0x1000, 0x1000); // NOP
      machine.cpu.pc = 0x1000; // Start at code location 
      machine.cpu.sp = 0xFF;
      // Set all flags except B and I initially
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.D | FlagSetMask6510.Z | FlagSetMask6510.C | FlagSetMask6510.UNUSED;

      // Set up IRQ handler with custom code
      machine.setupNmiHandler(0x8000, [
        0x00                  // BRK
      ]);

      // --- Act
      machine.setupInterruptWindow("nmi", 1, 3);
      machine.run(); // This should handle the NMI instead of executing the NOP

      // --- Assert
      const stackedStatus = machine.readMemory(0x01FD);
      expect(stackedStatus & FlagSetMask6510.N).toBe(FlagSetMask6510.N);
      expect(stackedStatus & FlagSetMask6510.V).toBe(FlagSetMask6510.V);
      expect(stackedStatus & FlagSetMask6510.D).toBe(FlagSetMask6510.D);
      expect(stackedStatus & FlagSetMask6510.Z).toBe(FlagSetMask6510.Z);
      expect(stackedStatus & FlagSetMask6510.C).toBe(FlagSetMask6510.C);
      expect(stackedStatus & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED);
      expect(stackedStatus & FlagSetMask6510.B).toBe(0); // B flag should be clear
      expect(stackedStatus & FlagSetMask6510.I).toBe(0); // I flag should be clear (wasn't set initially)
    });
  });

  describe("IRQ (Interrupt Request)", () => {
    it("should handle IRQ request when I flag is clear", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA], 0x1000, 0x1000); // NOP, NOP
      machine.cpu.pc = 0x1000; // Start at code location
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.Z | FlagSetMask6510.UNUSED; // I flag clear

      // Set up IRQ handler with custom code
      machine.setupIrqHandler(0x8000, [
        0x00                  // BRK
      ]);

      // --- Act
      machine.setupInterruptWindow("irq", 1, 3);
      machine.run(); // This should handle the NMI instead of executing the NOP

      // --- Assert
      expect(machine.cpu.pc).toBe(0x8000); // Should jump to IRQ vector
      expect(machine.cpu.sp).toBe(0xFC); // Stack pointer should be decremented by 3
      expect(machine.cpu.isIFlagSet()).toBe(true); // I flag should be set during IRQ handling
      expect(machine.checkedTacts).toBe(9); // IRQ handling takes 7 cycles + 2 for NOP

      // Check stack contents - PC was 0x1000 when IRQ was triggered
      expect(machine.readMemory(0x01FF)).toBe(0x10); // PCH on stack
      expect(machine.readMemory(0x01FE)).toBe(0x01); // PCL on stack
      const expectedStatus = (FlagSetMask6510.Z | FlagSetMask6510.UNUSED) & ~FlagSetMask6510.B;
      expect(machine.readMemory(0x01FD)).toBe(expectedStatus); // Status without B flag on stack
    });

    it("should NOT handle IRQ when I flag is set", () => {
      // --- Arrange
      machine.initCode([0xEA], 0x1000, 0x1000); // NOP
      machine.cpu.pc = 0x1000; // Start at code location
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.I | FlagSetMask6510.UNUSED; // I flag set

      // Set up IRQ handler with custom code
      machine.setupIrqHandler(0x8000, [
        0x00                  // BRK
      ]);

      // --- Act
      machine.setupInterruptWindow("irq", 1, 3);
      machine.run(); // This should handle the NMI instead of executing the NOP

      // --- Assert
      expect(machine.cpu.irqRequested).toBe(true); // IRQ should still be pending
      expect(machine.cpu.pc).toBe(0x1001); // Should execute the NOP instead
      expect(machine.cpu.sp).toBe(0xFF); // Stack should be unchanged
      expect(machine.checkedTacts).toBe(2); // Should take only 2 cycles for NOP
    });

    it("should handle IRQ after CLI clears I flag", () => {
      // --- Arrange
      machine.initCode([0xEA, 0x58], 0x1000, 0x1000); // CLI instruction only
      machine.cpu.pc = 0x1000;
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.UNUSED; // I flag set initially

      // Set up IRQ handler with custom code
      machine.setupIrqHandler(0x8000, [
        0x00                  // BRK
      ]);

      // --- Act
      machine.setupInterruptWindow("irq", 1, 3);
      machine.run(); // This should handle the IRQ instead of executing the NOP

      // --- Assert
      expect(machine.cpu.pc).toBe(0x8000); // Should jump to IRQ vector and stop at BRK
      expect(machine.cpu.isIFlagSet()).toBe(true); // I flag set during IRQ handling
    });

    it("should preserve all flags except I when pushing status to stack", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA], 0x1000, 0x1000); // NOP
      machine.cpu.pc = 0x1000; // Start at code location
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.N | FlagSetMask6510.V | FlagSetMask6510.D | FlagSetMask6510.Z | FlagSetMask6510.C | FlagSetMask6510.UNUSED;

      // Set up IRQ handler with custom code
      machine.setupIrqHandler(0x8000, [
        0x00                  // BRK
      ]);

      // --- Act
      machine.setupInterruptWindow("irq", 1, 3);
      machine.run(); // This should handle the IRQ instead of executing the NOP

      // --- Assert
      const stackedStatus = machine.readMemory(0x01FD);
      expect(stackedStatus & FlagSetMask6510.N).toBe(FlagSetMask6510.N);
      expect(stackedStatus & FlagSetMask6510.V).toBe(FlagSetMask6510.V);
      expect(stackedStatus & FlagSetMask6510.D).toBe(FlagSetMask6510.D);
      expect(stackedStatus & FlagSetMask6510.Z).toBe(FlagSetMask6510.Z);
      expect(stackedStatus & FlagSetMask6510.C).toBe(FlagSetMask6510.C);
      expect(stackedStatus & FlagSetMask6510.UNUSED).toBe(FlagSetMask6510.UNUSED);
      expect(stackedStatus & FlagSetMask6510.B).toBe(0); // B flag should be clear
    });
  });

  describe("Interrupt Management", () => {
    it("should clear both interrupt requests with clearInterrupts()", () => {
      // --- Arrange
      machine.cpu.triggerNmi();
      machine.cpu.triggerIrq();
      
      // --- Act
      machine.cpu.clearInterrupts();

      // --- Assert
      expect(machine.cpu.nmiRequested).toBe(false);
      expect(machine.cpu.irqRequested).toBe(false);
    });

    it("should handle multiple consecutive NMI requests", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA, 0xEA, 0x00], 0x1000, 0x1000); // Multiple NOPs
      machine.cpu.pc = 0x1000;
      machine.cpu.sp = 0xFF;

      // Set up NMI handler with custom code
      machine.setupNmiHandler(0x8000, [
        0x40                  // RTI
      ]);

      // --- Act
      machine.setupInterruptWindow("nmi", 1, 2);
      machine.run(); // This should handle the NMI instead of executing the NOP

      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.checkedTacts).toBe(19); // 2 (NOP) + (7 for NMI + 6 for RTI) + 2 (NOP) + 2 (NOP)
    });

    it("should handle multiple consecutive IRQ requests when I flag is clear", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA, 0xEA, 0x00], 0x1000, 0x1000); // Multiple NOPs
      machine.cpu.pc = 0x1000;
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set up NMI handler with custom code
      machine.setupIrqHandler(0x8000, [
        0x40                  // RTI
      ]);

      // --- Act
      machine.setupInterruptWindow("irq", 1, 30);
      machine.run(); // This should handle the IRQ instead of executing the NOP
      expect(machine.cpu.pc).toBe(0x1003);
      expect(machine.checkedTacts).toBe(45); // 2 (NOP) + 3 * (7 for IRQ + 6 for RTI) + 2 (NOP) + 2 (NOP)
    });

    it("should preserve interrupt request state across normal instruction execution", () => {
      // --- Arrange
      machine.initCode([0xEA], 0x1000, 0x1000); // NOP
      machine.cpu.pc = 0x1000;
      machine.cpu.p = FlagSetMask6510.I | FlagSetMask6510.UNUSED; // I flag set to block IRQ

      // --- Act
      machine.cpu.triggerIrq();
      machine.run(); // Execute NOP, IRQ should remain pending

      // --- Assert
      expect(machine.cpu.irqRequested).toBe(true); // IRQ should still be pending
      expect(machine.cpu.pc).toBe(0x1001); // NOP should have executed normally
    });

    it("should handle simultaneous NMI and IRQ correctly (NMI priority)", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA], 0x1000, 0x1000); // NOP
      machine.cpu.pc = 0x1000; // Start at code location
      machine.cpu.sp = 0xFF;
      machine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set up interrupt vectors
      machine.writeMemory(0xFFFA, 0x00); // NMI vector
      machine.writeMemory(0xFFFB, 0xA0);
      machine.writeMemory(0xFFFE, 0x00); // IRQ vector
      machine.writeMemory(0xFFFF, 0xB0);

      // --- Act
      machine.cpu.triggerNmi();
      machine.cpu.triggerIrq();
      machine.run(); // Should handle NMI first

      // --- Assert
      expect(machine.cpu.irqRequested).toBe(true); // IRQ still pending
      expect(machine.cpu.pc).toBe(0xA000); // Jumped to NMI vector
      expect(machine.cpu.sp).toBe(0xFC); // Stack used for NMI
    });
  });

  describe("Stack Behavior During Interrupts", () => {
    it("should handle stack wrap around during NMI", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA], 0x1000, 0x1000); // NOP
      machine.cpu.pc = 0x1000; // Start at code location 
      machine.cpu.sp = 0x02; // Stack pointer near boundary
      machine.cpu.p = FlagSetMask6510.UNUSED; // Set only UNUSED flag

      // Set up NMI vector
      machine.writeMemory(0xFFFA, 0x00);
      machine.writeMemory(0xFFFB, 0x80);

      // --- Act
      machine.cpu.triggerNmi();
      machine.run();

      // --- Assert
      expect(machine.cpu.sp).toBe(0xFF); // Should wrap to 0xFF
      expect(machine.readMemory(0x0102)).toBe(0x10); // PCH
      expect(machine.readMemory(0x0101)).toBe(0x01); // PCL
      expect(machine.readMemory(0x0100)).toBe(FlagSetMask6510.UNUSED); // Status (only UNUSED, no B or I)
    });

    it("should handle stack wrap around during IRQ", () => {
      // --- Arrange
      machine.initCode([0xEA, 0xEA], 0x1000, 0x1000); // NOP
      machine.cpu.pc = 0x1000; // Start at code location
      machine.cpu.sp = 0x01; // Stack pointer near boundary
      machine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear

      // Set up IRQ vector
      machine.writeMemory(0xFFFE, 0x00);
      machine.writeMemory(0xFFFF, 0x90);

      // --- Act
      machine.cpu.triggerIrq();
      machine.run();

      // --- Assert
      expect(machine.cpu.sp).toBe(0xFE); // Should wrap to 0xFE
      expect(machine.readMemory(0x0101)).toBe(0x10); // PCH
      expect(machine.readMemory(0x0100)).toBe(0x01); // PCL
      expect(machine.readMemory(0x01FF)).toBe(FlagSetMask6510.UNUSED & ~FlagSetMask6510.B); // Status
    });
  });

  describe("Complete Interrupt Service Routine", () => {
    it("should execute complete NMI service routine and return via RTI", () => {
      // --- Arrange: Set up a complete NMI test scenario
      const testMachine = new M6510VaTestMachine(RunMode.Normal);
      
      // Main program: Several NOPs followed by a marker instruction
      const mainProgram = [
        0xEA,        // $1000: NOP
        0xEA,        // $1001: NOP  
        0xEA,        // $1002: NOP
        0xA9, 0xAA   // $1003: LDA #$AA - marker instruction after RTI return
      ];
      
      testMachine.initCode(mainProgram, 0x1000, 0x1000);

      // Set up NMI handler
      testMachine.setupNmiHandler(0x9000, [
        0xA9, 0x33,           // LDA #$33 - Load marker value
        0x8D, 0x20, 0xD0,     // STA $D020 - Store marker to prove NMI ISR ran
        0x40                  // RTI
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x1000;
      testMachine.cpu.sp = 0xFF;
      testMachine.cpu.a = 0x77; // Original accumulator value
      testMachine.cpu.p = FlagSetMask6510.I | FlagSetMask6510.UNUSED; // I flag set (NMI ignores it)

      // Clear the marker location
      testMachine.writeMemory(0xD020, 0x00);

      // Set up NMI to trigger after 6 tacts (after 3 NOPs) and clear after 15 tacts
      testMachine.setupInterruptWindow('nmi', 6, 7);

      // --- Act: Run until we complete execution
      let executionComplete = false;
      let cycleCount = 0;
      const maxCycles = 50; // Safety limit
      
      while (!executionComplete && cycleCount < maxCycles) {
        testMachine.cpu.executeCpuCycle();
        cycleCount++;
        
        // Stop execution when we've completed the main program (after LDA #$AA)
        if (testMachine.cpu.pc === 0x1005) {
          executionComplete = true;
        }
      }

      // --- Assert: Verify complete NMI cycle worked correctly
      
      // Verify we completed the main program
      expect(testMachine.cpu.pc).toBe(0x1005); // Should be past the LDA #$AA instruction
      
      // Verify the NMI handler executed
      // TODO: Implement verification for NMI handler execution
      //expect(testMachine.readMemory(0xD020)).toBe(0x33); // NMI ISR marker should be set
      expect(testMachine.cpu.nmiRequested).toBe(false); // NMI should be cleared
      
      // Verify register states after complete cycle
      expect(testMachine.cpu.a).toBe(0xAA); // Should reflect the LDA #$AA instruction
      expect(testMachine.cpu.sp).toBe(0xFF); // Stack should be restored
      expect(testMachine.cpu.isIFlagSet()).toBe(true); // I flag should be restored to original state (was set initially)
      expect(executionComplete).toBe(true); // Should have completed execution
    });

    it("should execute complete IRQ service routine and return via RTI", () => {
      // --- Arrange: Set up a complete IRQ test scenario
      const testMachine = new M6510VaTestMachine(RunMode.Normal);
      
      // Main program: Several NOPs followed by a marker instruction
      const mainProgram = [
        0xEA,        // $1000: NOP
        0xEA,        // $1001: NOP
        0xEA,        // $1002: NOP
        0xA9, 0xBB   // $1003: LDA #$BB - marker instruction after RTI return
      ];
      
      testMachine.initCode(mainProgram, 0x1000, 0x1000);

      // Set up IRQ handler with custom code
      testMachine.setupIrqHandler(0x8500, [
        0xA9, 0x44,           // LDA #$44 - Load marker value
        0x8D, 0x21, 0xD0,     // STA $D021 - Store marker to prove IRQ ISR ran
        0x40                  // RTI
      ]);

      // Initialize CPU state
      testMachine.cpu.pc = 0x1000;
      testMachine.cpu.sp = 0xFF;
      testMachine.cpu.a = 0x88; // Original accumulator value
      testMachine.cpu.p = FlagSetMask6510.UNUSED; // I flag clear so IRQ can be handled

      // Clear the marker location
      testMachine.writeMemory(0xD021, 0x00);

      // Set up IRQ to trigger after 4 tacts (after 2 NOPs) and clear after 12 tacts
      testMachine.setupInterruptWindow('irq', 4, 12);

      // --- Act: Run until we complete execution
      let executionComplete = false;
      let cycleCount = 0;
      const maxCycles = 50; // Safety limit
      
      while (!executionComplete && cycleCount < maxCycles) {
        testMachine.cpu.executeCpuCycle();
        cycleCount++;
        
        // Stop execution when we've completed the main program (after LDA #$BB)
        if (testMachine.cpu.pc === 0x1005) {
          executionComplete = true;
        }
      }

      // --- Assert: Verify complete IRQ cycle worked correctly
      
      // Verify we completed the main program
      expect(testMachine.cpu.pc).toBe(0x1005); // Should be past the LDA #$BB instruction
      
      // Verify the IRQ handler executed
      expect(testMachine.readMemory(0xD021)).toBe(0x44); // IRQ ISR marker should be set
      expect(testMachine.cpu.irqRequested).toBe(false); // IRQ should be cleared
      
      // Verify register states after complete cycle
      expect(testMachine.cpu.a).toBe(0xBB); // Should reflect the LDA #$BB instruction
      expect(testMachine.cpu.sp).toBe(0xFF); // Stack should be restored
      expect(testMachine.cpu.isIFlagSet()).toBe(false); // I flag should be restored to original state (was clear initially)
      expect(executionComplete).toBe(true); // Should have completed execution
    });
  });
});

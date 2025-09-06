import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

describe("M6510 Register Transfer Instructions", () => {
  describe("TXA (Transfer X to Accumulator) - 0x8A", () => {
    it("TXA transfers X register to accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x8a], 0x1000, 0x1000); // TXA
      machine.cpu.x = 0x42;
      machine.cpu.a = 0x00; // Different from X to verify transfer

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x42); // A should equal X
      expect(machine.cpu.x).toBe(0x42); // X should be unchanged
      expect(machine.cpu.isZFlagSet()).toBe(false); // 0x42 is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // 0x42 bit 7 is 0
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.checkedTacts).toBe(2); // TXA takes 2 cycles
    });

    it("TXA sets zero flag when X is 0x00", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x8a], 0x1000, 0x1000); // TXA
      machine.cpu.x = 0x00;
      machine.cpu.a = 0xff; // Different from X

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x00);
      expect(machine.cpu.isZFlagSet()).toBe(true); // Zero flag should be set
      expect(machine.cpu.isNFlagSet()).toBe(false); // Negative flag should be clear
    });

    it("TXA sets negative flag when X has bit 7 set", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x8a], 0x1000, 0x1000); // TXA
      machine.cpu.x = 0x80; // Bit 7 set
      machine.cpu.a = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x80);
      expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Negative flag should be set
    });

    it("TXA preserves other flags", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x8a], 0x1000, 0x1000); // TXA
      machine.cpu.x = 0x42;
      machine.cpu.p = 0x6D; // Set C, D, I, V flags (bits 0, 3, 2, 6) = 0x01 + 0x08 + 0x04 + 0x40 + 0x20 = 0x6D

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x42);
      expect(machine.cpu.isCFlagSet()).toBe(true); // Carry should be preserved
      expect(machine.cpu.isDFlagSet()).toBe(true); // Decimal should be preserved
      expect(machine.cpu.isIFlagSet()).toBe(true); // Interrupt should be preserved
      expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow should be preserved
    });
  });

  describe("TYA (Transfer Y to Accumulator) - 0x98", () => {
    it("TYA transfers Y register to accumulator", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x98], 0x1000, 0x1000); // TYA
      machine.cpu.y = 0x55;
      machine.cpu.a = 0x00; // Different from Y to verify transfer

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x55); // A should equal Y
      expect(machine.cpu.y).toBe(0x55); // Y should be unchanged
      expect(machine.cpu.isZFlagSet()).toBe(false); // 0x55 is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // 0x55 bit 7 is 0
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.checkedTacts).toBe(2); // TYA takes 2 cycles
    });

    it("TYA sets zero flag when Y is 0x00", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x98], 0x1000, 0x1000); // TYA
      machine.cpu.y = 0x00;
      machine.cpu.a = 0xff; // Different from Y

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x00);
      expect(machine.cpu.isZFlagSet()).toBe(true); // Zero flag should be set
      expect(machine.cpu.isNFlagSet()).toBe(false); // Negative flag should be clear
    });

    it("TYA sets negative flag when Y has bit 7 set", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0x98], 0x1000, 0x1000); // TYA
      machine.cpu.y = 0xf0; // Bit 7 set
      machine.cpu.a = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0xf0);
      expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Negative flag should be set
    });
  });

  describe("TAY (Transfer Accumulator to Y) - 0xA8", () => {
    it("TAY transfers accumulator to Y register", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xa8], 0x1000, 0x1000); // TAY
      machine.cpu.a = 0x33;
      machine.cpu.y = 0x00; // Different from A to verify transfer

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.y).toBe(0x33); // Y should equal A
      expect(machine.cpu.a).toBe(0x33); // A should be unchanged
      expect(machine.cpu.isZFlagSet()).toBe(false); // 0x33 is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // 0x33 bit 7 is 0
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.checkedTacts).toBe(2); // TAY takes 2 cycles
    });

    it("TAY sets zero flag when accumulator is 0x00", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xa8], 0x1000, 0x1000); // TAY
      machine.cpu.a = 0x00;
      machine.cpu.y = 0xff; // Different from A

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.y).toBe(0x00);
      expect(machine.cpu.isZFlagSet()).toBe(true); // Zero flag should be set
      expect(machine.cpu.isNFlagSet()).toBe(false); // Negative flag should be clear
    });

    it("TAY sets negative flag when accumulator has bit 7 set", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xa8], 0x1000, 0x1000); // TAY
      machine.cpu.a = 0x90; // Bit 7 set
      machine.cpu.y = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.y).toBe(0x90);
      expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Negative flag should be set
    });
  });

  describe("TAX (Transfer Accumulator to X) - 0xAA", () => {
    it("TAX transfers accumulator to X register", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xaa], 0x1000, 0x1000); // TAX
      machine.cpu.a = 0x77;
      machine.cpu.x = 0x00; // Different from A to verify transfer

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.x).toBe(0x77); // X should equal A
      expect(machine.cpu.a).toBe(0x77); // A should be unchanged
      expect(machine.cpu.isZFlagSet()).toBe(false); // 0x77 is not zero
      expect(machine.cpu.isNFlagSet()).toBe(false); // 0x77 bit 7 is 0
      expect(machine.cpu.pc).toBe(0x1001);
      expect(machine.checkedTacts).toBe(2); // TAX takes 2 cycles
    });

    it("TAX sets zero flag when accumulator is 0x00", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xaa], 0x1000, 0x1000); // TAX
      machine.cpu.a = 0x00;
      machine.cpu.x = 0xff; // Different from A

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.x).toBe(0x00);
      expect(machine.cpu.isZFlagSet()).toBe(true); // Zero flag should be set
      expect(machine.cpu.isNFlagSet()).toBe(false); // Negative flag should be clear
    });

    it("TAX sets negative flag when accumulator has bit 7 set", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xaa], 0x1000, 0x1000); // TAX
      machine.cpu.a = 0xc0; // Bit 7 set
      machine.cpu.x = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.x).toBe(0xc0);
      expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Negative flag should be set
    });
  });

  describe("Register Transfer Edge Cases", () => {
    it("Transfer instructions with all possible flag combinations", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      
      // Test TAX with 0xFF (all bits set)
      machine.initCode([0xaa], 0x1000, 0x1000); // TAX
      machine.cpu.a = 0xff;
      machine.cpu.x = 0x00;

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.x).toBe(0xff);
      expect(machine.cpu.isZFlagSet()).toBe(false); // Not zero
      expect(machine.cpu.isNFlagSet()).toBe(true); // Negative (bit 7 set)
    });

    it("Multiple transfers preserve register values correctly", () => {
      // --- Test TAX: A = 0x42 -> X
      const machine1 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine1.initCode([0xaa], 0x1000, 0x1000); // TAX
      machine1.cpu.a = 0x42;
      machine1.cpu.x = 0x00;
      machine1.cpu.y = 0x00;
      machine1.run();
      expect(machine1.cpu.x).toBe(0x42);
      expect(machine1.cpu.a).toBe(0x42);

      // --- Test TAY: A = 0x42 -> Y (using fresh machine)
      const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine2.initCode([0xa8], 0x1000, 0x1000); // TAY
      machine2.cpu.a = 0x42;
      machine2.cpu.x = 0x42; // Set to previous result
      machine2.cpu.y = 0x00;
      machine2.run();
      expect(machine2.cpu.y).toBe(0x42);
      expect(machine2.cpu.a).toBe(0x42);
      expect(machine2.cpu.x).toBe(0x42); // X should still be 0x42
    });

    it("Transfers between index registers via accumulator", () => {
      // --- Test TXA: X = 0x99 -> A
      const machine1 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine1.initCode([0x8a], 0x1000, 0x1000); // TXA
      machine1.cpu.x = 0x99;
      machine1.cpu.y = 0x00;
      machine1.cpu.a = 0x00;
      machine1.run();
      expect(machine1.cpu.a).toBe(0x99);

      // --- Test TAY: A = 0x99 -> Y (using fresh machine)
      const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine2.initCode([0xa8], 0x1000, 0x1000); // TAY
      machine2.cpu.a = 0x99; // Set from previous result
      machine2.cpu.x = 0x99; // Set to simulate previous state
      machine2.cpu.y = 0x00;
      machine2.run();
      expect(machine2.cpu.y).toBe(0x99);
      expect(machine2.cpu.a).toBe(0x99);
      expect(machine2.cpu.x).toBe(0x99); // X should still be 0x99
    });
  });
});

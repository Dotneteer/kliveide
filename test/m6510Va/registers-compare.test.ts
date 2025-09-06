import { describe, it, expect } from "vitest";
import { M6510VaTestMachine, RunMode } from "./test-m6510Va";

describe("M6510 Compare Instructions", () => {
  describe("CMP (Compare Accumulator) Instructions", () => {
    describe("CMP # (Immediate) - 0xC9", () => {
      it("CMP immediate with equal values sets Z flag and C flag", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc9, 0x42], 0x1000, 0x1000); // CMP #$42
        machine.cpu.a = 0x42;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x42); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(true); // Equal values
        expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow (A >= operand)
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result bit 7 is 0
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(2); // CMP # takes 2 cycles
      });

      it("CMP immediate with A > operand sets C flag only", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc9, 0x30], 0x1000, 0x1000); // CMP #$30
        machine.cpu.a = 0x50;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x50); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(false); // Not equal
        expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow (A >= operand)
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result (0x20) bit 7 is 0
      });

      it("CMP immediate with A < operand clears C flag and may set N flag", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc9, 0x80], 0x1000, 0x1000); // CMP #$80
        machine.cpu.a = 0x40;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x40); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(false); // Not equal
        expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred (A < operand)
        expect(machine.cpu.isNFlagSet()).toBe(true); // Result (0xC0) bit 7 is 1
      });

      it("CMP immediate with wrap-around sets N flag", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc9, 0x01], 0x1000, 0x1000); // CMP #$01
        machine.cpu.a = 0x00;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x00); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(false); // Not equal
        expect(machine.cpu.isCFlagSet()).toBe(false); // Borrow occurred
        expect(machine.cpu.isNFlagSet()).toBe(true); // Result (0xFF) bit 7 is 1
      });
    });

    describe("CMP zp (Zero Page) - 0xC5", () => {
      it("CMP zero page works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc5, 0x80], 0x1000, 0x1000); // CMP $80
        machine.memory[0x80] = 0x33;
        machine.cpu.a = 0x33;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x33);
        expect(machine.cpu.isZFlagSet()).toBe(true);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(3); // CMP zp takes 3 cycles
      });
    });

    describe("CMP abs (Absolute) - 0xCD", () => {
      it("CMP absolute works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xcd, 0x00, 0x20], 0x1000, 0x1000); // CMP $2000
        machine.memory[0x2000] = 0x55;
        machine.cpu.a = 0x77;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x77);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isCFlagSet()).toBe(true); // 0x77 >= 0x55
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result (0x22) bit 7 is 0
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.checkedTacts).toBe(4); // CMP abs takes 4 cycles
      });
    });

    describe("CMP zp,X (Zero Page,X) - 0xD5", () => {
      it("CMP zero page,X works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xd5, 0x80], 0x1000, 0x1000); // CMP $80,X
        machine.cpu.x = 0x05;
        machine.memory[0x85] = 0x44; // 0x80 + 0x05
        machine.cpu.a = 0x44;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x44);
        expect(machine.cpu.isZFlagSet()).toBe(true);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(4); // CMP zp,X takes 4 cycles
      });

      it("CMP zero page,X handles wrap-around", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xd5, 0xff], 0x1000, 0x1000); // CMP $FF,X
        machine.cpu.x = 0x02;
        machine.memory[0x01] = 0x66; // (0xFF + 0x02) & 0xFF = 0x01
        machine.cpu.a = 0x66;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x66);
        expect(machine.cpu.isZFlagSet()).toBe(true);
        expect(machine.cpu.isCFlagSet()).toBe(true);
      });
    });

    describe("CMP abs,X (Absolute,X) - 0xDD", () => {
      it("CMP absolute,X works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xdd, 0x00, 0x20], 0x1000, 0x1000); // CMP $2000,X
        machine.cpu.x = 0x10;
        machine.memory[0x2010] = 0x88; // 0x2000 + 0x10
        machine.cpu.a = 0x77;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x77);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isCFlagSet()).toBe(false); // 0x77 < 0x88
        expect(machine.cpu.isNFlagSet()).toBe(true); // Result (0xEF) bit 7 is 1
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.checkedTacts).toBe(4); // Base cycles, may add 1 for page boundary
      });
    });

    describe("CMP abs,Y (Absolute,Y) - 0xD9", () => {
      it("CMP absolute,Y works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xd9, 0x00, 0x20], 0x1000, 0x1000); // CMP $2000,Y
        machine.cpu.y = 0x08;
        machine.memory[0x2008] = 0x99; // 0x2000 + 0x08
        machine.cpu.a = 0x99;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x99);
        expect(machine.cpu.isZFlagSet()).toBe(true);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.pc).toBe(0x1003);
      });
    });

    describe("CMP (zp,X) (Indexed Indirect) - 0xC1", () => {
      it("CMP indexed indirect works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc1, 0x20], 0x1000, 0x1000); // CMP ($20,X)
        machine.cpu.x = 0x04;
        machine.memory[0x24] = 0x00; // Low byte of target address
        machine.memory[0x25] = 0x30; // High byte of target address (0x3000)
        machine.memory[0x3000] = 0xaa;
        machine.cpu.a = 0xaa;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0xaa);
        expect(machine.cpu.isZFlagSet()).toBe(true);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(6); // CMP (zp,X) takes 6 cycles
      });
    });

    describe("CMP (zp),Y (Indirect Indexed) - 0xD1", () => {
      it("CMP indirect indexed works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xd1, 0x20], 0x1000, 0x1000); // CMP ($20),Y
        machine.cpu.y = 0x05;
        machine.memory[0x20] = 0x00; // Low byte of base address
        machine.memory[0x21] = 0x30; // High byte of base address (0x3000)
        machine.memory[0x3005] = 0xbb; // 0x3000 + 0x05
        machine.cpu.a = 0xaa;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0xaa);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isCFlagSet()).toBe(false); // 0xAA < 0xBB
        expect(machine.cpu.isNFlagSet()).toBe(true); // Result (0xEF) bit 7 is 1
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(5); // Base cycles, may add 1 for page boundary
      });
    });
  });

  describe("CPX (Compare X Register) Instructions", () => {
    describe("CPX # (Immediate) - 0xE0", () => {
      it("CPX immediate with equal values sets Z and C flags", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xe0, 0x55], 0x1000, 0x1000); // CPX #$55
        machine.cpu.x = 0x55;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.x).toBe(0x55); // X register unchanged
        expect(machine.cpu.isZFlagSet()).toBe(true);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.isNFlagSet()).toBe(false);
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(2); // CPX # takes 2 cycles
      });

      it("CPX immediate with X > operand sets C flag only", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xe0, 0x30], 0x1000, 0x1000); // CPX #$30
        machine.cpu.x = 0x50;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.x).toBe(0x50);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.isNFlagSet()).toBe(false);
      });

      it("CPX immediate with X < operand clears C flag", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xe0, 0x80], 0x1000, 0x1000); // CPX #$80
        machine.cpu.x = 0x40;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.x).toBe(0x40);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isCFlagSet()).toBe(false);
        expect(machine.cpu.isNFlagSet()).toBe(true);
      });
    });

    describe("CPX zp (Zero Page) - 0xE4", () => {
      it("CPX zero page works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xe4, 0x50], 0x1000, 0x1000); // CPX $50
        machine.memory[0x50] = 0x77;
        machine.cpu.x = 0x77;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.x).toBe(0x77);
        expect(machine.cpu.isZFlagSet()).toBe(true);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(3); // CPX zp takes 3 cycles
      });
    });

    describe("CPX abs (Absolute) - 0xEC", () => {
      it("CPX absolute works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xec, 0x00, 0x25], 0x1000, 0x1000); // CPX $2500
        machine.memory[0x2500] = 0x33;
        machine.cpu.x = 0x44;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.x).toBe(0x44);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isCFlagSet()).toBe(true); // 0x44 >= 0x33
        expect(machine.cpu.isNFlagSet()).toBe(false); // Result (0x11) bit 7 is 0
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.checkedTacts).toBe(4); // CPX abs takes 4 cycles
      });
    });
  });

  describe("CPY (Compare Y Register) Instructions", () => {
    describe("CPY # (Immediate) - 0xC0", () => {
      it("CPY immediate with equal values sets Z and C flags", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc0, 0x66], 0x1000, 0x1000); // CPY #$66
        machine.cpu.y = 0x66;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.y).toBe(0x66); // Y register unchanged
        expect(machine.cpu.isZFlagSet()).toBe(true);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.isNFlagSet()).toBe(false);
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(2); // CPY # takes 2 cycles
      });

      it("CPY immediate with Y > operand sets C flag only", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc0, 0x20], 0x1000, 0x1000); // CPY #$20
        machine.cpu.y = 0x40;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.y).toBe(0x40);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.isNFlagSet()).toBe(false);
      });

      it("CPY immediate with Y < operand clears C flag", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc0, 0x90], 0x1000, 0x1000); // CPY #$90
        machine.cpu.y = 0x30;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.y).toBe(0x30);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isCFlagSet()).toBe(false);
        expect(machine.cpu.isNFlagSet()).toBe(true);
      });
    });

    describe("CPY zp (Zero Page) - 0xC4", () => {
      it("CPY zero page works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xc4, 0x60], 0x1000, 0x1000); // CPY $60
        machine.memory[0x60] = 0x88;
        machine.cpu.y = 0x88;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.y).toBe(0x88);
        expect(machine.cpu.isZFlagSet()).toBe(true);
        expect(machine.cpu.isCFlagSet()).toBe(true);
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(3); // CPY zp takes 3 cycles
      });
    });

    describe("CPY abs (Absolute) - 0xCC", () => {
      it("CPY absolute works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0xcc, 0x00, 0x26], 0x1000, 0x1000); // CPY $2600
        machine.memory[0x2600] = 0x99;
        machine.cpu.y = 0x77;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.y).toBe(0x77);
        expect(machine.cpu.isZFlagSet()).toBe(false);
        expect(machine.cpu.isCFlagSet()).toBe(false); // 0x77 < 0x99
        expect(machine.cpu.isNFlagSet()).toBe(true); // Result (0xDE) bit 7 is 1
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.checkedTacts).toBe(4); // CPY abs takes 4 cycles
      });
    });
  });

  describe("Compare Instructions Edge Cases", () => {
    it("Compare preserves other flags", () => {
      // --- Arrange
      const machine = new M6510VaTestMachine(RunMode.OneInstruction);
      machine.initCode([0xc9, 0x42], 0x1000, 0x1000); // CMP #$42
      machine.cpu.a = 0x42;
      machine.cpu.p = 0x6D; // Set D, I, V flags (should be preserved)

      // --- Act
      machine.run();

      // --- Assert
      expect(machine.cpu.a).toBe(0x42);
      expect(machine.cpu.isZFlagSet()).toBe(true); // Equal comparison
      expect(machine.cpu.isCFlagSet()).toBe(true); // No borrow
      expect(machine.cpu.isNFlagSet()).toBe(false); // Result bit 7 is 0
      expect(machine.cpu.isDFlagSet()).toBe(true); // Decimal should be preserved
      expect(machine.cpu.isIFlagSet()).toBe(true); // Interrupt should be preserved
      expect(machine.cpu.isVFlagSet()).toBe(true); // Overflow should be preserved
    });

    it("Compare with boundary values", () => {
      // --- Test CMP with 0x00 vs 0xFF
      const machine1 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine1.initCode([0xc9, 0xff], 0x1000, 0x1000); // CMP #$FF
      machine1.cpu.a = 0x00;
      machine1.run();
      expect(machine1.cpu.isZFlagSet()).toBe(false);
      expect(machine1.cpu.isCFlagSet()).toBe(false); // 0x00 < 0xFF
      expect(machine1.cpu.isNFlagSet()).toBe(false); // Result (0x01) bit 7 is 0

      // --- Test CMP with 0xFF vs 0x00
      const machine2 = new M6510VaTestMachine(RunMode.OneInstruction);
      machine2.initCode([0xc9, 0x00], 0x1000, 0x1000); // CMP #$00
      machine2.cpu.a = 0xff;
      machine2.run();
      expect(machine2.cpu.isZFlagSet()).toBe(false);
      expect(machine2.cpu.isCFlagSet()).toBe(true); // 0xFF >= 0x00
      expect(machine2.cpu.isNFlagSet()).toBe(true); // Result (0xFF) bit 7 is 1
    });
  });

  describe("BIT (Bit Test) Instructions", () => {
    describe("BIT zp (Zero Page) - 0x24", () => {
      it("BIT zero page with all flags clear", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x24, 0x50], 0x1000, 0x1000); // BIT $50
        machine.memory[0x50] = 0x3F; // 00111111 - bits 6,7 clear
        machine.cpu.a = 0x0F; // 00001111 - will AND to non-zero

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x0F); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(false); // A AND memory = 0x0F (non-zero)
        expect(machine.cpu.isVFlagSet()).toBe(false); // Bit 6 of memory is 0
        expect(machine.cpu.isNFlagSet()).toBe(false); // Bit 7 of memory is 0
        expect(machine.cpu.pc).toBe(0x1002);
        expect(machine.checkedTacts).toBe(3); // BIT zp takes 3 cycles
      });

      it("BIT zero page with Z flag set", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x24, 0x50], 0x1000, 0x1000); // BIT $50
        machine.memory[0x50] = 0xF0; // 11110000
        machine.cpu.a = 0x0F; // 00001111 - will AND to zero

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x0F); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(true); // A AND memory = 0x00
        expect(machine.cpu.isVFlagSet()).toBe(true); // Bit 6 of memory is 1
        expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 of memory is 1
      });

      it("BIT zero page with V flag set only", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x24, 0x50], 0x1000, 0x1000); // BIT $50
        machine.memory[0x50] = 0x40; // 01000000 - only bit 6 set
        machine.cpu.a = 0x40; // Will AND to non-zero

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x40); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(false); // A AND memory = 0x40 (non-zero)
        expect(machine.cpu.isVFlagSet()).toBe(true); // Bit 6 of memory is 1
        expect(machine.cpu.isNFlagSet()).toBe(false); // Bit 7 of memory is 0
      });

      it("BIT zero page with N flag set only", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x24, 0x50], 0x1000, 0x1000); // BIT $50
        machine.memory[0x50] = 0x80; // 10000000 - only bit 7 set
        machine.cpu.a = 0x80; // Will AND to non-zero

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x80); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(false); // A AND memory = 0x80 (non-zero)
        expect(machine.cpu.isVFlagSet()).toBe(false); // Bit 6 of memory is 0
        expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 of memory is 1
      });

      it("BIT zero page with all flags set", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x24, 0x50], 0x1000, 0x1000); // BIT $50
        machine.memory[0x50] = 0xC0; // 11000000 - bits 6,7 set
        machine.cpu.a = 0x3F; // 00111111 - will AND to zero

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x3F); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(true); // A AND memory = 0x00
        expect(machine.cpu.isVFlagSet()).toBe(true); // Bit 6 of memory is 1
        expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 of memory is 1
      });
    });

    describe("BIT abs (Absolute) - 0x2C", () => {
      it("BIT absolute works correctly", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x2c, 0x00, 0x30], 0x1000, 0x1000); // BIT $3000
        machine.memory[0x3000] = 0xFF; // 11111111 - all bits set
        machine.cpu.a = 0x55; // 01010101 - will AND to 0x55 (non-zero)

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x55); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(false); // A AND memory = 0x55 (non-zero)
        expect(machine.cpu.isVFlagSet()).toBe(true); // Bit 6 of memory is 1
        expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 of memory is 1
        expect(machine.cpu.pc).toBe(0x1003);
        expect(machine.checkedTacts).toBe(4); // BIT abs takes 4 cycles
      });

      it("BIT absolute with zero result", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x2c, 0x00, 0x30], 0x1000, 0x1000); // BIT $3000
        machine.memory[0x3000] = 0xE0; // 11100000
        machine.cpu.a = 0x1F; // 00011111 - will AND to zero

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x1F); // Accumulator unchanged
        expect(machine.cpu.isZFlagSet()).toBe(true); // A AND memory = 0x00
        expect(machine.cpu.isVFlagSet()).toBe(true); // Bit 6 of memory is 1
        expect(machine.cpu.isNFlagSet()).toBe(true); // Bit 7 of memory is 1
      });
    });

    describe("BIT Instructions Edge Cases", () => {
      it("BIT preserves other flags", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x24, 0x50], 0x1000, 0x1000); // BIT $50
        machine.memory[0x50] = 0x3F; // Will clear N, V flags, clear Z flag
        machine.cpu.a = 0x0F;
        machine.cpu.p = 0x6D; // Set C, D, I flags (should be preserved)

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x0F);
        expect(machine.cpu.isZFlagSet()).toBe(false); // Result of AND
        expect(machine.cpu.isVFlagSet()).toBe(false); // Bit 6 of memory
        expect(machine.cpu.isNFlagSet()).toBe(false); // Bit 7 of memory
        expect(machine.cpu.isCFlagSet()).toBe(true); // Carry should be preserved
        expect(machine.cpu.isDFlagSet()).toBe(true); // Decimal should be preserved
        expect(machine.cpu.isIFlagSet()).toBe(true); // Interrupt should be preserved
      });

      it("BIT flag behavior with various bit patterns", () => {
        // Test specific bit patterns to verify flag behavior
        const testCases = [
          { memory: 0x00, accumulator: 0xFF, expectedZ: true, expectedV: false, expectedN: false },
          { memory: 0x40, accumulator: 0x00, expectedZ: true, expectedV: true, expectedN: false },
          { memory: 0x80, accumulator: 0x00, expectedZ: true, expectedV: false, expectedN: true },
          { memory: 0xC0, accumulator: 0x00, expectedZ: true, expectedV: true, expectedN: true },
          { memory: 0x7F, accumulator: 0xFF, expectedZ: false, expectedV: true, expectedN: false },
          { memory: 0xFF, accumulator: 0xFF, expectedZ: false, expectedV: true, expectedN: true },
        ];

        for (const testCase of testCases) {
          const machine = new M6510VaTestMachine(RunMode.OneInstruction);
          machine.initCode([0x24, 0x50], 0x1000, 0x1000); // BIT $50
          machine.memory[0x50] = testCase.memory;
          machine.cpu.a = testCase.accumulator;

          machine.run();

          expect(machine.cpu.isZFlagSet()).toBe(testCase.expectedZ);
          expect(machine.cpu.isVFlagSet()).toBe(testCase.expectedV);
          expect(machine.cpu.isNFlagSet()).toBe(testCase.expectedN);
        }
      });

      it("BIT does not modify accumulator or memory", () => {
        // --- Arrange
        const machine = new M6510VaTestMachine(RunMode.OneInstruction);
        machine.initCode([0x2c, 0x00, 0x30], 0x1000, 0x1000); // BIT $3000
        machine.memory[0x3000] = 0xAA;
        machine.cpu.a = 0x55;

        // --- Act
        machine.run();

        // --- Assert
        expect(machine.cpu.a).toBe(0x55); // Accumulator unchanged
        expect(machine.memory[0x3000]).toBe(0xAA); // Memory unchanged
      });
    });
  });
});

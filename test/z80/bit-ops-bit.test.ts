import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 bit ops 40-7f", () => {
  it("BIT n,B #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x40 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,B
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.b = ~(0x01 << n);

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(false);
      expect(m.cpu.isZFlagSet()).toBe(true);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(true);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,B #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x40 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,B
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.b = 0x01 << n;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(n === 0x07);
      expect(m.cpu.isZFlagSet()).toBe(false);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(false);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,C #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x41 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,C
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.c = ~(0x01 << n);

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(false);
      expect(m.cpu.isZFlagSet()).toBe(true);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(true);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,C #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x41 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,C
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.c = 0x01 << n;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(n === 0x07);
      expect(m.cpu.isZFlagSet()).toBe(false);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(false);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,D #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x42 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,D
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.d = ~(0x01 << n);

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(false);
      expect(m.cpu.isZFlagSet()).toBe(true);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(true);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,D #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x42 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,D
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.d = 0x01 << n;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(n === 0x07);
      expect(m.cpu.isZFlagSet()).toBe(false);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(false);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,E #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x43 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,E
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.e = ~(0x01 << n);

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(false);
      expect(m.cpu.isZFlagSet()).toBe(true);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(true);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,E #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x43 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,E
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.e = 0x01 << n;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(n === 0x07);
      expect(m.cpu.isZFlagSet()).toBe(false);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(false);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,H #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x44 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,H
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.h = ~(0x01 << n);

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(false);
      expect(m.cpu.isZFlagSet()).toBe(true);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(true);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,H #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x44 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,H
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.h = 0x01 << n;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(n === 0x07);
      expect(m.cpu.isZFlagSet()).toBe(false);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(false);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,L #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x45 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,L
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.l = ~(0x01 << n);

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(false);
      expect(m.cpu.isZFlagSet()).toBe(true);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(true);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,L #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x45 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,L
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.l = 0x01 << n;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(n === 0x07);
      expect(m.cpu.isZFlagSet()).toBe(false);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(false);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,(HL) #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x46 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,(HL)
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.hl = 0x1000;
      m.memory[m.cpu.hl] = ~(0x01 << n);

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(false);
      expect(m.cpu.isZFlagSet()).toBe(true);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(true);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(12);
    }
  });

  it("BIT n,(HL) #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x46 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,(HL)
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.hl = 0x1000;
      m.memory[m.cpu.hl] = 0x01 << n;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(n === 0x07);
      expect(m.cpu.isZFlagSet()).toBe(false);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(false);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(12);
    }
  });

  it("BIT n,A #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x47 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,A
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.a = ~(0x01 << n);

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(false);
      expect(m.cpu.isZFlagSet()).toBe(true);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(true);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("BIT n,A #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x47 | (n << 3);

      m.initCode([
        0xcb,
        opcn // BIT N,A
      ]);

      m.cpu.f &= 0xfe;
      m.cpu.a = 0x01 << n;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("F");
      m.shouldKeepMemory();

      expect(m.cpu.isSFlagSet()).toBe(n === 0x07);
      expect(m.cpu.isZFlagSet()).toBe(false);
      expect(m.cpu.isCFlagSet()).toBe(false);
      expect(m.cpu.isPvFlagSet()).toBe(false);
      expect(m.cpu.isHFlagSet()).toBe(true);
      expect(m.cpu.isNFlagSet()).toBe(false);

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });
});

import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed IY ops a0-af", () => {
  it("0xA0: AND A,B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x06,
      0x23, // LD B,23H
      0xfd,
      0xa0 // AND B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, B");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x02);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0xA1: AND A,C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x0e,
      0x23, // LD C,23H
      0xfd,
      0xa1 // AND C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, C");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x02);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0xA2: AND A,D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x16,
      0x23, // LD D,23H
      0xfd,
      0xa2 // AND D
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, D");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x02);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0xA3: AND A,E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x1e,
      0x23, // LD E,23H
      0xfd,
      0xa3 // AND E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, E");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x02);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0xA4: AND A,YH", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
      0xa4 // AND YH
    ]);
    m.cpu.iy = 0x23aa;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, IY");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x02);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0xA5: AND A,YL", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
      0xa5 // AND YL
    ]);
    m.cpu.iy = 0x23aa;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, IY");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x02);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0xA6: AND A,(IY+d)", () => {
    // --- Arrange
    const OFFS = 0x54;
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
      0xa6,
      0x54 // AND (IY+54H)
    ]);
    m.cpu.iy = 0x1000;
    m.memory[m.cpu.iy + OFFS] = 0x23;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x02);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(26);
  });

  it("0xA7: AND A,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
      0xa7 // AND A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x12);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0xA8: XOR A,B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x06,
      0x23, // LD B,23H
      0xfd,
      0xa8 // XOR B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, B");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x31);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0xA9: XOR A,C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x0e,
      0x23, // LD C,23H
      0xa9 // XOR C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, C");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x31);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0xAA: XOR A,D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x16,
      0x23, // LD D,23H
      0xaa // XOR D
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, D");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x31);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0xAB: XOR A,E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x1e,
      0x23, // LD E,23H
      0xfd,
      0xab // XOR E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, E");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x31);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0xAC: XOR A,YH", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
      0xac // XOR YH
    ]);
    m.cpu.iy = 0x23aa;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x31);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0xAD: XOR A,YL", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
      0xad // XOR YL
    ]);
    m.cpu.iy = 0xaa23;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x31);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0xAE: XOR A,(IY+d)", () => {
    // --- Arrange
    const OFFS = 0x54;
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
      0xae,
      0x54 // XOR (IY+54H)
    ]);
    m.cpu.iy = 0x1000;
    m.memory[m.cpu.iy + OFFS] = 0x23;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x31);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(26);
  });

  it("0xAF: XOR A,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
      0xaf // XOR A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x00);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });
});

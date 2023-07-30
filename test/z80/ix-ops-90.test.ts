import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";
import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";

describe("Z80 standard ops 90-9f", () => {
  it("0x90: SUB A,B #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x06,
      0x24, // LD B,24H
      0xdd,
      0x90 // SUB B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, B");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x12);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0x91: SUB A,C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x0e,
      0x24, // LD C,24H
      0xdd,
      0x91 // SUB C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, C");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x12);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0x92: SUB A,D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x16,
      0x24, // LD D,24H
      0xdd,
      0x92 // SUB D
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, D");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x12);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0x93: SUB A,E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x1e,
      0x24, // LD E,24H
      0xdd,
      0x93 // SUB E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, E");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x12);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0x94: SUB A,XH", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0xdd,
      0x21,
      0x3d,
      0x24, // LD IX,243DH
      0xdd,
      0x94 // SUB XH
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, IX");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x12);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(29);
  });

  it("0x95: SUB A,XL", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0xdd,
      0x21,
      0x24,
      0x3d, // LD IX,3D24H
      0xdd,
      0x95 // SUB XL
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, IX");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x12);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(29);
  });

  it("0x96: SUB A,(IX+d)", () => {
    // --- Arrange
    const OFFS = 0x54;
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x37, // SCF
      0xdd,
      0x96,
      0x54 // SUB (IX+54H)
    ]);
    m.cpu.ix = 0x1000;
    m.memory[m.cpu.ix + OFFS] = 0x24;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, IX");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x12);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(30);
  });

  it("0x97: SUB A,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0xdd,
      0x97 // SUB A
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
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0x98: SBC A,B", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x06,
      0x24, // LD B,24H
      0x37, // SCF
      0xdd,
      0x98 // SBC B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, B");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x11);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(26);
  });

  it("0x99: SBC A,C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x0e,
      0x24, // LD C,24H
      0x37, // SCF
      0xdd,
      0x99 // SBC C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, C");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x11);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(26);
  });

  it("0x9A: SBC A,D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x16,
      0x24, // LD D,24H
      0x37, // SCF
      0xdd,
      0x9a // SBC D
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, D");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x11);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(26);
  });

  it("0x9B: SBC A,E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x1e,
      0x24, // LD E,24H
      0x37, // SCF
      0xdd,
      0x9b // SBC E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, E");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x11);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(26);
  });

  it("0x9C: SBC A,XH", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0xdd,
      0x21,
      0x3d,
      0x24, // LD IX,243DH
      0xdd,
      0x9c // SBC XH
    ]);
    m.cpu.f |= FlagsSetMask.C;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, IX");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x11);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(29);
  });

  it("0x9D: SBC A,XL", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0xdd,
      0x21,
      0x24,
      0x3d, // LD IX,3D24H
      0xdd,
      0x9d // SBC XL
    ]);
    m.cpu.f |= FlagsSetMask.C;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, IX");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x11);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(29);
  });

  it("0x9E: SBC A,(IX+d)", () => {
    // --- Arrange
    const OFFS = 0x54;
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x37, // SCF
      0xdd,
      0x9e,
      0x54 // SBC (IX+54H)
    ]);
    m.cpu.ix = 0x1000;
    m.cpu.f |= FlagsSetMask.C;
    m.memory[m.cpu.ix + OFFS] = 0x24;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, IX");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x11);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(30);
  });

  it("0x9F: SBC A,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x37, // SCF
      0xdd,
      0x9f // SBC A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0xff);
    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(19);
  });
});

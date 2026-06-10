import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed ops 10-1f", () => {
  it("0x10: djnz (no jump)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0x01, // LD B,01H
      0xdd,
      0x10,
      0x02 // DJNZ 02H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B");
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(19);
  });

  it("0x11: ld de,NN", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xdd,
      0x11,
      0x26,
      0xa9 // LD DE,A926H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xa926);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(14);
  });

  it("0x12: ld (de),a", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x11,
      0x26,
      0xa9, // LD DE,A926H
      0x3e,
      0x94, // LD A,94H
      0xdd,
      0x12 // LD (DE),A
    ]);

    // --- Act
    const valueBefore = m.memory[0xa926];
    m.run();
    const valueAfter = m.memory[0xa926];

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE, A");
    m.shouldKeepMemory("A926");

    expect(cpu.de).toBe(0xa926);
    expect(cpu.a).toBe(0x94);
    expect(valueBefore).toBe(0);
    expect(valueAfter).toBe(0x94);
    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(28);
  });

  it("0x13: inc de ", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x11,
      0x26,
      0xa9, // LD DE,A926H
      0xdd,
      0x13 // INC DE
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xa927);
    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(20);
  });

  it("0x14: inc d", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x16,
      0x43, // LD D,43H
      0xdd,
      0x14 // INC D
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.d).toBe(0x44);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0x15: dec d", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x16,
      0x43, // LD D,43H
      0xdd,
      0x15 // DEC D
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.d).toBe(0x42);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0x16: ld d,N ", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x16,
      0x26 // LD D,26H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0x26);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x17: rla", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x81, // LD A,81H
      0xdd,
      0x17 // RLA
    ]);

    // --- Act
    m.cpu.f &= 0xfe;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    m.shouldKeepSFlag();
    m.shouldKeepZFlag();
    m.shouldKeepPVFlag();
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(true);

    expect(cpu.a).toBe(0x02);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0x18: jr e", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x20, // LD A,20H
      0xdd,
      0x18,
      0x20 // JR 20H
    ]);

    // --- Act
    const valueBefore = m.memory[0xa926];
    m.run();
    const valueAfter = m.memory[0xa926];

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("A");
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0025);
    expect(cpu.wz).toBe(0x0025);
    expect(cpu.tacts).toBe(23);
  });

  it("0x19: add ix,de", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x21,
      0x34,
      0x12, // LD HL,1234H
      0x11,
      0x02,
      0x11, // LD DE,1102H
      0xdd,
      0x19 // ADD IX,DE
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, DE, IX");
    m.shouldKeepMemory();
    m.shouldKeepSFlag();
    m.shouldKeepZFlag();
    m.shouldKeepPVFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);

    expect(cpu.ix).toBe(0x2336);
    expect(cpu.pc).toBe(0x0009);
    expect(cpu.tacts).toBe(39);
  });

  it("0x1a: ld a,(de) ", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x11,
      0x03,
      0x00, // LD DE,0003H
      0xdd,
      0x1a // LD A,(DE)
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE, A");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0xdd);
    expect(cpu.wz).toBe(0x0004);
    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(21);
  });

  it("0x1b: dec de ", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x11,
      0x26,
      0xa9, // LD DE,A926H
      0xdd,
      0x1b // DEC DE
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xa925);
    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(20);
  });

  it("0x1c: inc e", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x1e,
      0x43, // LD E,43H
      0xdd,
      0x1c // INC E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.e).toBe(0x44);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0x1d: dec e", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x1e,
      0x43, // LD E,43H
      0xdd,
      0x1d // DEC E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.e).toBe(0x42);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });

  it("0x1e: ld e,N ", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x1e,
      0x26 // LD E,26H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0x26);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x1f: rra", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x81, // LD A,81H
      0xdd,
      0x1f // RRA
    ]);

    // --- Act
    m.cpu.f &= 0xfe;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    m.shouldKeepSFlag();
    m.shouldKeepZFlag();
    m.shouldKeepPVFlag();
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(true);

    expect(cpu.a).toBe(0x40);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });
});

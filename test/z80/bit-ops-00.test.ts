import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 bit ops 00-0f", () => {
  it("0x00: RLC B #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x00 // RLC B
    ]);
    m.cpu.b = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();

    expect(cpu.b).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x00: RLC B #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x00 // RLC B
    ]);
    m.cpu.b = 0x84;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();

    expect(cpu.b).toBe(0x09);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x00: RLC B #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x00 // RLC B
    ]);
    m.cpu.b = 0x00;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();

    expect(cpu.b).toBe(0x00);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x00: RLC B #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x00 // RLC B
    ]);
    m.cpu.b = 0xc0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();

    expect(cpu.b).toBe(0x81);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x01: RLC C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x01 // RLC C
    ]);
    m.cpu.c = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();

    expect(cpu.c).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x02: RLC D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x02 // RLC D
    ]);
    m.cpu.d = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x03: RLC E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x03 // RLC E
    ]);
    m.cpu.e = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x04: RLC H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x04 // RLC H
    ]);
    m.cpu.h = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("H, F");
    m.shouldKeepMemory();

    expect(cpu.h).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x05: RLC L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x05 // RLC L
    ]);
    m.cpu.l = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("L, F");
    m.shouldKeepMemory();

    expect(cpu.l).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x06: RLC (HL)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x06 // RLC (HL)
    ]);
    m.cpu.hl = 0x1000;
    m.memory[m.cpu.hl] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F");
    m.shouldKeepMemory("1000");

    expect(m.memory[cpu.hl]).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(15);
  });

  it("0x07: RLC A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x07 // RLC A
    ]);
    m.cpu.a = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0x10);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x08: RRC B #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x08 // RRC B
    ]);
    m.cpu.b = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();

    expect(cpu.b).toBe(0x04);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x08: RRC B #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x08 // RRC B
    ]);
    m.cpu.b = 0x85;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();

    expect(cpu.b).toBe(0xc2);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x08: RRC B #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x08 // RRC B
    ]);
    m.cpu.b = 0x00;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();

    expect(cpu.b).toBe(0x00);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x08: RRC B #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x08 // RRC B
    ]);
    m.cpu.b = 0x41;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();

    expect(cpu.b).toBe(0xa0);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x09: RRC C", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x09 // RRC C
    ]);
    m.cpu.c = 0x85;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();

    expect(cpu.c).toBe(0xc2);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x0A: RRC D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x0a // RRC D
    ]);
    m.cpu.d = 0x85;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xc2);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x0B: RRC E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x0b // RRC E
    ]);
    m.cpu.e = 0x85;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xc2);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x0C: RRC H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x0c // RRC H
    ]);
    m.cpu.h = 0x85;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("H, F");
    m.shouldKeepMemory();

    expect(cpu.h).toBe(0xc2);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x0D: RRC L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x0d // RRC L
    ]);
    m.cpu.l = 0x85;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("L, F");
    m.shouldKeepMemory();

    expect(cpu.l).toBe(0xc2);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x0E: RLC (HL)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x0e // RLC (HL)
    ]);
    m.cpu.hl = 0x1000;
    m.memory[m.cpu.hl] = 0x08;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F");
    m.shouldKeepMemory("1000");

    expect(m.memory[cpu.hl]).toBe(0x04);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(15);
  });

  it("0x0F: RRC A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcb,
      0x0f // RRC A
    ]);
    m.cpu.a = 0x85;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0xc2);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });
});

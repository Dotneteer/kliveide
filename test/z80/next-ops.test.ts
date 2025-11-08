import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 next ops", () => {
  it("0x23: SWAPNIB (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x23 // SWAPNIB
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x23: SWAPNIB", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x23 // SWAPNIB
    ]);

    // --- Act
    m.cpu.a = 0x3c;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("A");
    expect(cpu.a).toBe(0xc3);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x24: MIRROR A (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x24 // MIRROR A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x24: MIRROR A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x24 // MIRROR A
    ]);

    // --- Act
    m.cpu.a = 0xe5;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("A");
    expect(cpu.a).toBe(0xa7);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x27: TEST N (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x27 // TEST N
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x27: TEST N #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x27,
      0x24 // TEST 0x24
    ]);

    // --- Act
    m.cpu.a = 0x36;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F");
    m.shouldKeepMemory();

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x27: TEST N #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x27,
      0x24 // TEST 0x24
    ]);

    // --- Act
    m.cpu.a = 0x17;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F");
    m.shouldKeepMemory();

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x28: BSLA DE,B (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x28 // BSLA DE,B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x28: BSLA DE,B #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x28 // BSLA DE,B
    ]);

    // --- Act
    m.cpu.de = 0xffff;
    m.cpu.b = 0x05;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xffe0);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x28: BSLA DE,B #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x28 // BSLA DE,B
    ]);

    // --- Act
    m.cpu.de = 0xffff;
    m.cpu.b = 0x65;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xffe0);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x28: BSLA DE,B #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x28 // BSLA DE,B
    ]);

    // --- Act
    m.cpu.de = 0xffff;
    m.cpu.b = 0x12;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x0000);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x28: BSLA DE,B #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x28 // BSLA DE,B
    ]);

    // --- Act
    m.cpu.de = 0xffff;
    m.cpu.b = 0x0c;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xf000);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x29: BSRA DE,B (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x29 // BSRA DE,B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x29: BSRA DE,B #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x29 // BSRA DE,B
    ]);

    // --- Act
    m.cpu.de = 0xffff;
    m.cpu.b = 0x05;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xffff);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x29: BSRA DE,B #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x29 // BSRA DE,B
    ]);

    // --- Act
    m.cpu.de = 0x13ff;
    m.cpu.b = 0x65;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x009f);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x29: BSRA DE,B #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x29 // BSRA DE,B
    ]);

    // --- Act
    m.cpu.de = 0x12ff;
    m.cpu.b = 0x12;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x0000);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x29: BSRA DE,B #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x29 // BSRA DE,B
    ]);

    // --- Act
    m.cpu.de = 0x1fff;
    m.cpu.b = 0x0a;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x0007);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2A: BSRL DE,B (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x2a // BSRL DE,B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2A: BSRL DE,B #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2a // BSRL
    ]);

    // --- Act
    m.cpu.de = 0xffff;
    m.cpu.b = 0x05;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x07ff);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2A: BSRL DE,B #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2a // BSRL DE,B
    ]);

    // --- Act
    m.cpu.de = 0x13ff;
    m.cpu.b = 0x65;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x009f);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2A: BSRL DE,B #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2a // BSRL DE,B
    ]);

    // --- Act
    m.cpu.de = 0x12ff;
    m.cpu.b = 0x12;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x0000);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2A: BSRL DE,B #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2a // BSRL DE,B
    ]);

    // --- Act
    m.cpu.de = 0x1fff;
    m.cpu.b = 0x0a;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x0007);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2B: BSRF DE,B (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x2b // BSRF DE,B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2B: BSRF DE,B #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2b // BSRF DE,B
    ]);

    // --- Act
    m.cpu.de = 0xffff;
    m.cpu.b = 0x05;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xffff);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2B: BSRF DE,B #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2b // BSRF DE,B
    ]);

    // --- Act
    m.cpu.de = 0x13ff;
    m.cpu.b = 0x65;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xf89f);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2B: BSRF DE,B #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2b // BSRF DE,B
    ]);

    // --- Act
    m.cpu.de = 0x12ff;
    m.cpu.b = 0x12;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xffff);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2B: BSRF DE,B #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2b // BSRF DE,B
    ]);

    // --- Act
    m.cpu.de = 0x1fff;
    m.cpu.b = 0x0a;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xffc7);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2C: BRLC DE,B (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x2c // BRLC DE,B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2C: BRLC DE,B #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2c // BRLC DE,B
    ]);

    // --- Act
    m.cpu.de = 0xffff;
    m.cpu.b = 0x05;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xffff);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2C: BRLC DE,B #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2c // BRCL DE,B
    ]);

    // --- Act
    m.cpu.de = 0x13ff;
    m.cpu.b = 0x65;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x7fe2);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2C: BRLC DE,B #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2c // BRLC DE,B
    ]);

    // --- Act
    m.cpu.de = 0x12ff;
    m.cpu.b = 0x12;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x4bfc);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x2C: BRLC DE,B #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x2c // BRLC DE,B
    ]);

    // --- Act
    m.cpu.de = 0x1fff;
    m.cpu.b = 0x0a;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0xfc7f);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x30: MUL D,E (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x30 // MUL D,E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x30: MUL D,E #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0x11,
      0x21,
      0x34, // LD DE,0x3421
      0xed,
      0x30 // MUL D,E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    expect(cpu.de).toBe(0x06b4);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0x30: MUL D,E #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0x11,
      0x34,
      0x21, // LD DE,0x2134
      0xed,
      0x30 // MUL D,E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    expect(cpu.de).toBe(0x06b4);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0x30: MUL D,E #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0x11,
      0xfe,
      0xbc, // LD DE,0xbcfe
      0xed,
      0x30 // MUL D,E
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    expect(cpu.de).toBe(0xba88);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0x31: ADD HL,A (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x31 // ADD HL,A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x31: ADD HL,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0x21,
      0x01,
      0x23, // LD HL,0x2301
      0xed,
      0x31 // ADD HL,A
    ]);

    // --- Act
    m.cpu.a = 0xa2;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    expect(cpu.hl).toBe(0x23a3);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0x32: ADD DE,A (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x32 // ADD DE,A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x32: ADD DE,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0x11,
      0x01,
      0x23, // LD DE,0x2301
      0xed,
      0x32 // ADD DE,A
    ]);

    // --- Act
    m.cpu.a = 0xa2;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    expect(cpu.de).toBe(0x23a3);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0x33: ADD BC,A (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x33 // ADD BC,A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x33: ADD BC,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0x01,
      0x01,
      0x23, // LD BC,0x2301
      0xed,
      0x33 // ADD BC,A
    ]);

    // --- Act
    m.cpu.a = 0xa2;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC");
    expect(cpu.bc).toBe(0x23a3);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0x34: ADD HL,NN (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x34 // ADD HL,NN
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x34: ADD HL,NN", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0x21,
      0x10,
      0x20, // LD HL,0x2010
      0xed,
      0x34,
      0x20,
      0x10 // ADD HL,0x1020
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    expect(cpu.hl).toBe(0x3030);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(26);
  });

  it("0x35: ADD DE,NN (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x35 // ADD DE,NN
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x35: ADD DE,NN", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0x11,
      0x10,
      0x20, // LD DE,0x2010
      0xed,
      0x35,
      0x20,
      0x10 // ADD DE,0x1020
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    expect(cpu.de).toBe(0x3030);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(26);
  });

  it("0x36: ADD BC,NN (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x36 // ADD BC,NN
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x36: ADD BC,NN", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0x01,
      0x10,
      0x20, // LD BC,0x2010
      0xed,
      0x36,
      0x20,
      0x10 // ADD BC,0x1020
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC");
    expect(cpu.bc).toBe(0x3030);
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(26);
  });

  it("0x8A: PUSH NN (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x8a // PUSH NN
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x8A: PUSH NN", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0xed,
      0x8a,
      0x23,
      0xab, // PUSH 0x23ab
      0xe1 // POP HL
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.hl).toBe(0x23ab);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(33);
  });

  it("0x90: OUTINB (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x90 // OUTINB
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x90: OUTINB #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0xed,
      0x90 // OUTINB
    ]);
    m.cpu.bc = 0x10cc;
    m.cpu.hl = 0x1000;
    m.memory[m.cpu.hl] = 0x29;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, HL");
    m.shouldKeepMemory("1000");

    expect(cpu.b).toBe(0x10);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x10cc);
    expect(m.ioAccessLog[0].value).toBe(0x29);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0x90: OUTINB #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0xed,
      0x90 // OUTINB
    ]);
    m.cpu.bc = 0x01cc;
    m.cpu.hl = 0x1000;
    m.memory[m.cpu.hl] = 0x29;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory("1000");

    expect(cpu.b).toBe(0x01);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x01cc);
    expect(m.ioAccessLog[0].value).toBe(0x29);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0x91: NEXTREG N,N (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x91 // NEXTREG
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x91: NEXTREG N,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x91,
      0x13,
      0xac // NEXTREG 0x13,0xac
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(m.tbBlueAccessLog.length).toBe(1);
    expect(m.tbBlueAccessLog[0].address).toBe(0x13);
    expect(m.tbBlueAccessLog[0].value).toBe(0xac);
    expect(m.tbBlueAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(20);
  });

  it("0x92: NEXTREG N,A (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x92 // NEXTREG
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x92: NEXTREG N,A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x92,
      0x13,
    ]);

    // --- Act
    m.cpu.a = 0xac;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(m.tbBlueAccessLog.length).toBe(1);
    expect(m.tbBlueAccessLog[0].address).toBe(0x13);
    expect(m.tbBlueAccessLog[0].value).toBe(0xac);
    expect(m.tbBlueAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(17);
  });

  it("0x93: PIXELDN (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x93 // PIXELDN
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x93: PIXELDN #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x93 // PIXELDN
    ]);

    // --- Act
    m.cpu.hl = 0x4100;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x4200);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x93: PIXELDN #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x93, // PIXELDN
    ]);

    // --- Act
    m.cpu.hl = 0x4725;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x4045);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x93: PIXELDN #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x93, // PIXELDN
    ]);

    // --- Act
    m.cpu.hl = 0x47e6;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x4806);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x94: PIXELAD (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x94 // PIXELAD
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x94: PIXELAD #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x94 // PIXELAD
    ]);

    // --- Act
    m.cpu.de = 0x0000;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x4000);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x94: PIXELAD #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x94 // PIXELAD
    ]);

    // --- Act
    m.cpu.de = 0x004a;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x4009);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x94: PIXELAD #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x94 // PIXELAD
    ]);

    // --- Act
    m.cpu.de = 0x4a00;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x4a20);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x94: PIXELAD #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x94 // PIXELAD
    ]);

    // --- Act
    m.cpu.de = 0x4aa3;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x4a34);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x95: SETAE (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x95, // SETAE
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x95 SETAE #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x95 // SETAE
    ]);

    // --- Act
    m.cpu.e = 0x00;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("A");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0x80);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x95 SETAE #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x95 // SETAE
    ]);

    // --- Act
    m.cpu.e = 0x03;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("A");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0x10);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x95 SETAE #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x95 // SETAE
    ]);

    // --- Act
    m.cpu.e = 0x23;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("A");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0x10);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x95 SETAE #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x95 // SETAE
    ]);

    // --- Act
    m.cpu.e = 0x4f;
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("A");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0x01);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x98: JP (C) (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x98, // JP (C)
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x98 JP (C) #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x98 // SETAE
    ], 0xa123, 0xa123);

    // --- Act
    m.ioInputSequence.push(0x41);
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x9040);
    expect(cpu.tacts).toBe(13);
  });

  it("0x98 JP (C) #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0x98 // SETAE
    ], 0xc123, 0xc123);

    // --- Act
    m.ioInputSequence.push(0x41);
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0xD040);
    expect(cpu.tacts).toBe(13);
  });

  it("0xA4: LDIX (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xA4, // LDIX
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0xA4: LDIX #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0xa4 // LDIX
    ]);
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x1001;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.de] = 0x11;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("1001");

    expect(m.memory[0x1001]).toBe(0xa5);
    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x1001);
    expect(cpu.de).toBe(0x1002);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA4: LDIX #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0xa4 // LDIX
    ]);
    m.cpu.a &= 0xa5;
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x1001;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.de] = 0x11;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("1001");

    expect(m.memory[0x1001]).toBe(0x11);
    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x1001);
    expect(cpu.de).toBe(0x1002);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA5: LDWS (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xA5, // LDWS
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0xA5: LDWS", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0xa5 // LDIX
    ]);
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x2001;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.de] = 0x11;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE, HL");
    m.shouldKeepMemory("2001");

    expect(m.memory[0x2001]).toBe(0xa5);
    expect(cpu.hl).toBe(0x1001);
    expect(cpu.de).toBe(0x2101);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(14);
  });

  it("0xAC: LDDX (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xAC, // LDDX
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0xAC: LDDX #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0xac // LDDX
    ]);
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x1001;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.de] = 0x11;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("1001");

    expect(m.memory[0x1001]).toBe(0xa5);
    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x0fff);
    expect(cpu.de).toBe(0x1002);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xAC: LDDX #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction, true);
    m.initCode([
      0xed,
      0xac // LDDX
    ]);
    m.cpu.a &= 0xa5;
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x1001;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.de] = 0x11;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("1001");

    expect(m.memory[0x1001]).toBe(0x11);
    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x0fff);
    expect(cpu.de).toBe(0x1002);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });


  it("0xB4: LDIRX (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xB4, // LDIRX
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0xB4: LDIRX #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0xed,
      0xb4 // LDIRX
    ]);
    m.cpu.bc = 0x0003;
    m.cpu.hl = 0x1001;
    m.cpu.de = 0x1000;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.hl + 1] = 0xa6;
    m.memory[m.cpu.hl + 2] = 0xa7;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("1000-1002");

    expect(m.memory[0x1000]).toBe(0xa5);
    expect(m.memory[0x1001]).toBe(0xa6);
    expect(m.memory[0x1002]).toBe(0xa7);
    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x1004);
    expect(cpu.de).toBe(0x1003);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(58);
  });

  it("0xB4: LDIRX #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0xed,
      0xb4 // LDIRX
    ]);
    m.cpu.a = 0xa6;
    m.cpu.bc = 0x0003;
    m.cpu.hl = 0x1001;
    m.cpu.de = 0x2000;
    m.memory[m.cpu.de] = 0x11;
    m.memory[m.cpu.de + 1] = 0x12;
    m.memory[m.cpu.de + 2] = 0x13;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.hl + 1] = 0xa6;
    m.memory[m.cpu.hl + 2] = 0xa7;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("2000-2002");

    expect(m.memory[0x2000]).toBe(0xa5);
    expect(m.memory[0x2001]).toBe(0x12);
    expect(m.memory[0x2002]).toBe(0xa7);
    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x1004);
    expect(cpu.de).toBe(0x2003);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(58);
  });

  it("0xB7: LDPIRX (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xB7, // LDPIRX
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0xB7: LPIRX #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0xed,
      0xb7 // LPIRX
    ]);
    m.cpu.bc = 0x0003;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x2000;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.hl + 1] = 0xa6;
    m.memory[m.cpu.hl + 2] = 0xa7;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("2000-2002");

    expect(m.memory[0x1000]).toBe(0xa5);
    expect(m.memory[0x1001]).toBe(0xa6);
    expect(m.memory[0x1002]).toBe(0xa7);
    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x1000);
    expect(cpu.de).toBe(0x2003);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(58);
  });

  it("0xB7: LPIRX #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0xed,
      0xb7 // LPIRX
    ]);
    m.cpu.a = 0xa6;
    m.cpu.bc = 0x0003;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x2000;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.hl + 1] = 0xa6;
    m.memory[m.cpu.hl + 2] = 0xa7;
    m.memory[m.cpu.de] = 0x11;
    m.memory[m.cpu.de + 1] = 0x12;
    m.memory[m.cpu.de + 2] = 0x13;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("2000-2002");

    expect(m.memory[0x1000]).toBe(0xa5);
    expect(m.memory[0x1001]).toBe(0xa6);
    expect(m.memory[0x1002]).toBe(0xa7);
    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x1000);
    expect(cpu.de).toBe(0x2003);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(58);
  });

  it("0xBC: LDDRX (ext not allowed)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xBC, // LDDRX
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0xBC: LDDRX #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0xed,
      0xbc // LDDRX
    ]);
    m.cpu.bc = 0x0003;
    m.cpu.hl = 0x1001;
    m.cpu.de = 0x2000;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.hl - 1] = 0xa6;
    m.memory[m.cpu.hl - 2] = 0xa7;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("2000-2002");

    expect(m.memory[0x2000]).toBe(0xa5);
    expect(m.memory[0x2001]).toBe(0xa6);
    expect(m.memory[0x2002]).toBe(0xa7);
    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x0ffe);
    expect(cpu.de).toBe(0x2003);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(58);
  });

  it("0xBC: LDDRX #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd, true);
    m.initCode([
      0xed,
      0xbc // LDDRX
    ]);
    m.cpu.a = 0xa6
    m.cpu.bc = 0x0003;
    m.cpu.hl = 0x1001;
    m.cpu.de = 0x2000;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.hl - 1] = 0xa6;
    m.memory[m.cpu.hl - 2] = 0xa7;
    m.memory[m.cpu.de] = 0x11;
    m.memory[m.cpu.de + 1] = 0x12;
    m.memory[m.cpu.de + 2] = 0x13;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, DE, HL");
    m.shouldKeepMemory("2000-2002");

    expect(m.memory[0x2000]).toBe(0xa5);
    expect(m.memory[0x2001]).toBe(0x12);
    expect(m.memory[0x2002]).toBe(0xa7);
    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x0ffe);
    expect(cpu.de).toBe(0x2003);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(58);
  });
});

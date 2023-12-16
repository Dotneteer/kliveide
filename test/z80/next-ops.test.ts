import "mocha";
import { expect } from "expect";
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
      0x2a, // BSRL DE,B
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

    expect(cpu.de).toBe(0xF89f);

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
      0x2b, // BSRF DE,B
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
      0x2c, // BRLC DE,B
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

});

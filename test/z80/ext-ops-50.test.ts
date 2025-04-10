import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 extended ops 50-5f", () => {
  it("0x50: IN D,(C)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x50 // IN D,(C)
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("D, F");
    m.shouldKeepMemory();

    expect(cpu.d).toBe(0xd5);
    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1234);
    expect(m.ioAccessLog[0].value).toBe(0xd5);
    expect(m.ioAccessLog[0].isOutput).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(12);
  });

  it("0x51: OUT (C),D", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x51 // OUT (C),D
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;
    m.cpu.de = 0x3c3c;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1234);
    expect(m.ioAccessLog[0].value).toBe(0x3c);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(12);
  });

  it("0x52: SBC HL,DE", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x52 // SBC HL,DE
    ]);
    m.cpu.f |= 0x01;
    m.cpu.hl = 0x3456;
    m.cpu.de = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL, F");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x2221);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(15);
  });

  it("0x53: LD (nn),DE", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x53,
      0x00,
      0x10 // LD (1000H),DE
    ]);
    m.cpu.de = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory("1000-1001");

    expect(m.memory[0x1000]).toBe(0x34);
    expect(m.memory[0x1001]).toBe(0x12);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(20);
  });

  it("0x54: NEG", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x54 // NEG
    ]);
    m.cpu.a = 0x03;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0xfd);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x55: RETN", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0xed,
      0x55 // RETN
    ]);
    m.cpu.iff1 = false;
    m.cpu.sp = 0x0000;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("fffe-ffff");

    expect(m.cpu.iff1).toBe(m.cpu.iff2);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(42);
  });

  it("0x56: IM 1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x56 // IM 1
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(m.cpu.interruptMode).toBe(1);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x57: LD A,I #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0xd5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(m.cpu.a).toBe(0xd5);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x57: LD A,I #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0xd5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0xd5);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x57: LD A,I #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0xd5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isSFlagSet()).toBe(true);

    expect(m.cpu.a).toBe(0xd5);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x57: LD A,I #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0x25;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isSFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0x25);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x57: LD A,I #5", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0x00;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isZFlagSet()).toBe(true);

    expect(m.cpu.a).toBe(0x00);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x57: LD A,I #6", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0x25;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isZFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0x25);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x57: LD A,I #7", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0x25;
    m.cpu.iff2 = false;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isPvFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0x25);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x57: LD A,I #8", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0x25;
    m.cpu.iff2 = true;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isPvFlagSet()).toBe(true);

    expect(m.cpu.a).toBe(0x25);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x57: LD A,I #9", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0x25;
    m.cpu.f |= 0x01;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isCFlagSet()).toBe(true);

    expect(m.cpu.a).toBe(0x25);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x57: LD A,I #10", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x57 // LD A,I
    ]);
    m.cpu.i = 0x25;
    m.cpu.f &= 0xfe;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isCFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0x25);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x58: IN E,(C)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x58 // IN E,(C)
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("E, F");
    m.shouldKeepMemory();

    expect(cpu.e).toBe(0xd5);
    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1234);
    expect(m.ioAccessLog[0].value).toBe(0xd5);
    expect(m.ioAccessLog[0].isOutput).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(12);
  });

  it("0x59: OUT (C),E", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x59 // OUT (C),E
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;
    m.cpu.de = 0x3c3c;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1234);
    expect(m.ioAccessLog[0].value).toBe(0x3c);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(12);
  });

  it("0x5A: ADC HL,DE", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5a // ADC HL,DE
    ]);
    m.cpu.f |= 0x01;
    m.cpu.hl = 0x1111;
    m.cpu.de = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL, F");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x2346);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(15);
  });

  it("0x5B: LD DE,(nn)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5b,
      0x00,
      0x10 // LD DE,(1000H)
    ]);
    m.memory[0x1000] = 0x34;
    m.memory[0x1001] = 0x12;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE");
    m.shouldKeepMemory();

    expect(cpu.de).toBe(0x1234);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(20);
  });

  it("0x5C: NEG", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5c // NEG
    ]);
    m.cpu.a = 0x03;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0xfd);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x5D: RETN", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0xed,
      0x5d // RETN
    ]);
    m.cpu.iff1 = false;
    m.cpu.sp = 0x0000;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("fffe-ffff");

    expect(m.cpu.iff1).toBe(m.cpu.iff2);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(42);
  });

  it("0x5E: IM 2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5e // IM 2
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(m.cpu.interruptMode).toBe(2);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x5F: LD A,R #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0xd5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(m.cpu.a).toBe(0xd6);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x5F: LD A,R #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0xd3;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0xd4);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x5F: LD A,R #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0xd3;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isSFlagSet()).toBe(true);

    expect(m.cpu.a).toBe(0xd4);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x5F: LD A,R #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0x23;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isSFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0x24);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x5F: LD A,R #5", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0x7f;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isZFlagSet()).toBe(true);

    expect(m.cpu.a).toBe(0x00);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x5F: LD A,R #6", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0x23;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isZFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0x24);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x5F: LD A,R #7", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0x23;
    m.cpu.iff2 = false;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isPvFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0x24);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x5F: LD A,R #8", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0x23;
    m.cpu.iff2 = true;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isPvFlagSet()).toBe(true);

    expect(m.cpu.a).toBe(0x24);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x5F: LD A,R #9", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0x23;
    m.cpu.f |= 0x01;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isCFlagSet()).toBe(true);

    expect(m.cpu.a).toBe(0x24);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });

  it("0x5F: LD A,R #10", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x5f // LD A,R
    ]);
    m.cpu.r = 0x23;
    m.cpu.f &= 0xfe;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isCFlagSet()).toBe(false);

    expect(m.cpu.a).toBe(0x24);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(9);
  });
});

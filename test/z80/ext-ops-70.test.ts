import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 extended ops 70-7f", () => {
  it("0x70: IN (C)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x70 // IN (C)
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F");
    m.shouldKeepMemory();

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1234);
    expect(m.ioAccessLog[0].value).toBe(0xd5);
    expect(m.ioAccessLog[0].isOutput).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(12);
  });

  it("0x71: OUT (C),0", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x71 // OUT (C),0
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1234);
    expect(m.ioAccessLog[0].value).toBe(0x00);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(12);
  });

  it("0x72: SBC HL,SP", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x72 // SBC HL,SP
    ]);
    m.cpu.f |= 0x01;
    m.cpu.hl = 0x3456;
    m.cpu.sp = 0x1234;

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

  it("0x73: LD (nn),SP", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x73,
      0x00,
      0x10 // LD (1000H),SP
    ]);
    m.cpu.sp = 0x1234;

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

  it("0x74: NEG", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x74 // NEG
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

  it("0x75: RETN", () => {
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
      0x75 // RETN
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

  it("0x76: IM 1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x76 // IM 1
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

  it("0x78: IN A,(C)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x78 // IN A,(C)
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0xd5);
    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1234);
    expect(m.ioAccessLog[0].value).toBe(0xd5);
    expect(m.ioAccessLog[0].isOutput).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(12);
  });

  it("0x79: OUT (C),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x79 // OUT (C),A
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;
    m.cpu.a = 0x3c;

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

  it("0x7A: ADC HL,SP", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x7a // ADC HL,SP
    ]);
    m.cpu.f |= 0x01;
    m.cpu.hl = 0x1111;
    m.cpu.sp = 0x1234;

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

  it("0x7B: LD SP,(nn)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x7b,
      0x00,
      0x10 // LD SP,(1000H)
    ]);
    m.memory[0x1000] = 0x34;
    m.memory[0x1001] = 0x12;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("SP");
    m.shouldKeepMemory();

    expect(cpu.sp).toBe(0x1234);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(20);
  });

  it("0x7C: NEG", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x7c // NEG
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

  it("0x7D: RETN", () => {
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
      0x7d // RETN
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

  it("0x7E: IM 2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x7e // IM 2
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
});

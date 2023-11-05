import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 extended ops 60-6f", () => {
  it("0x60: IN H,(C)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x60 // IN H,(C)
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("H, F");
    m.shouldKeepMemory();

    expect(cpu.h).toBe(0xd5);
    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1234);
    expect(m.ioAccessLog[0].value).toBe(0xd5);
    expect(m.ioAccessLog[0].isOutput).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(12);
  });

  it("0x61: OUT (C),H", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x61 // OUT (C),H
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;
    m.cpu.hl = 0x3c3c;

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

  it("0x62: SBC HL,HL", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x62 // SBC HL,HL
    ]);
    m.cpu.f |= 0x01;
    m.cpu.hl = 0x3456;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL, F");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0xffff);
    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(15);
  });

  it("0x63: LD (nn),HL", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x63,
      0x00,
      0x10 // LD (1000H),HL
    ]);
    m.cpu.hl = 0x1234;

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

  it("0x64: NEG", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x64 // NEG
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

  it("0x65: RETN", () => {
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
      0x65 // RETN
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

  it("0x66: IM 0", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x66 // IM 0
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(m.cpu.interruptMode).toBe(0);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x67: RRD #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x67 // RRD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.hl = 0x1000;
    m.memory[0x1000] = 0x56;
    m.cpu.a = 0x34;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1000");

    expect(cpu.a).toBe(0x36);
    expect(m.memory[0x1000]).toBe(0x45);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(18);
  });

  it("0x67: RRD #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x67 // RRD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.hl = 0x1000;
    m.memory[0x1000] = 0x56;
    m.cpu.a = 0xa4;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1000");

    expect(cpu.a).toBe(0xa6);
    expect(m.memory[0x1000]).toBe(0x45);
    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(18);
  });

  it("0x67: RRD #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x67 // RRD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.hl = 0x1000;
    m.memory[0x1000] = 0x50;
    m.cpu.a = 0x04;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1000");

    expect(cpu.a).toBe(0x00);
    expect(m.memory[0x1000]).toBe(0x45);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(18);
  });

  it("0x67: RRD #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x67 // RRD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.hl = 0x1000;
    m.memory[0x1000] = 0x50;
    m.cpu.a = 0x14;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1000");

    expect(cpu.a).toBe(0x10);
    expect(m.memory[0x1000]).toBe(0x45);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(18);
  });

  it("0x68: IN L,(C)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x68 // IN L,(C)
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("L, F");
    m.shouldKeepMemory();

    expect(cpu.l).toBe(0xd5);
    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1234);
    expect(m.ioAccessLog[0].value).toBe(0xd5);
    expect(m.ioAccessLog[0].isOutput).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(12);
  });

  it("0x69: OUT (C),L", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x69 // OUT (C),L
    ]);
    m.ioInputSequence.push(0xd5);
    m.cpu.bc = 0x1234;
    m.cpu.hl = 0x3c3c;

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

  it("0x6A: ADC HL,HL", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x6a // ADC HL,HL
    ]);
    m.cpu.f |= 0x01;
    m.cpu.hl = 0x1111;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL, F");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x2223);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(15);
  });

  it("0x6B: LD HL,(nn)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x6b,
      0x00,
      0x10 // LD HL,(1000H)
    ]);
    m.memory[0x1000] = 0x34;
    m.memory[0x1001] = 0x12;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL");
    m.shouldKeepMemory();

    expect(cpu.hl).toBe(0x1234);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(20);
  });

  it("0x6C: NEG", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x6c // NEG
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

  it("0x6D: RETN", () => {
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
      0x6d // RETN
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

  it("0x6E: IM 0", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x6e // IM 0
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(m.cpu.interruptMode).toBe(0);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0x6F: RLD #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x6f // RLD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.hl = 0x1000;
    m.memory[0x1000] = 0x56;
    m.cpu.a = 0x34;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1000");

    expect(cpu.a).toBe(0x35);
    expect(m.memory[0x1000]).toBe(0x64);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(18);
  });

  it("0x6F: RLD #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x6f // RLD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.hl = 0x1000;
    m.memory[0x1000] = 0x56;
    m.cpu.a = 0xa4;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1000");

    expect(cpu.a).toBe(0xa5);
    expect(m.memory[0x1000]).toBe(0x64);
    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(18);
  });

  it("0x6F: RLD #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x6f // RLD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.hl = 0x1000;
    m.memory[0x1000] = 0x06;
    m.cpu.a = 0x04;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1000");

    expect(cpu.a).toBe(0x00);
    expect(m.memory[0x1000]).toBe(0x64);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(18);
  });

  it("0x6F: RLD #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0x6f // RLD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.hl = 0x1000;
    m.memory[0x1000] = 0x06;
    m.cpu.a = 0x14;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("1000");

    expect(cpu.a).toBe(0x10);
    expect(m.memory[0x1000]).toBe(0x64);
    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(18);
  });
});

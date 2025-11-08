import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed IX ops c0-cf", () => {
  it("0xC0: RET NZ", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0xb7, // OR A
      0xdd,
      0xc0, // RET NZ
      0x3e,
      0x24, // LD A,24H
      0xc9 // RET
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.a).toBe(0x16);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(47);
  });

  it("0xC1: POP BC", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x52,
      0x23, // LD HL,2352H
      0xe5, // PUSH HL
      0xdd,
      0xc1 // POP BC
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL, BC");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.bc).toBe(0x2352);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(35);
  });

  it("0xC2: JP NZ,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xb7, // OR A
      0xdd,
      0xc2,
      0x08,
      0x00, // JP NZ,0007H
      0x76, // HALT
      0x3e,
      0xaa, // LD A,AAH
      0x76 // HALT
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0xaa);

    expect(cpu.pc).toBe(0x000a);
    expect(cpu.tacts).toBe(36);
  });

  it("0xC3: JP nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xdd,
      0xc3,
      0x07,
      0x00, // JP 0006H
      0x76, // HALT
      0x3e,
      0xaa, // LD A,AAH
      0x76 // HALT
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0xaa);

    expect(cpu.pc).toBe(0x0009);
    expect(cpu.tacts).toBe(32);
  });

  it("0xC4: CALL NZ,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xb7, // OR A
      0xdd,
      0xc4,
      0x08,
      0x00, // CALL NZ,0008H
      0x76, // HALT
      0x3e,
      0x24, // LD A,24H
      0xc9 // RET
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.a).toBe(0x24);

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(53);
  });

  it("0xC5: PUSH BC", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x01,
      0x52,
      0x23, // LD BC,2352H
      0xdd,
      0xc5, // PUSH BC
      0xe1 // POP HL
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL, BC");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.hl).toBe(0x2352);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(35);
  });

  it("0xC6: ADD A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xdd,
      0xc6,
      0x24 // ADD,24H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x36);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0xC7: RST 00", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xdd,
      0xc7 // RST 0
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("SP");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.a).toBe(0x12);
    expect(cpu.sp).toBe(0xfffe);
    expect(m.memory[0xfffe]).toBe(0x04);
    expect(m.memory[0xffff]).toBe(0x00);

    expect(cpu.pc).toBe(0x0000);
    expect(cpu.tacts).toBe(22);
  });

  it("0xC8: RET Z", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0xaf, // XOR A
      0xdd,
      0xc8, // RET Z
      0x3e,
      0x24, // LD A,24H
      0xc9 // RET
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.a).toBe(0x00);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(47);
  });

  it("0xC9: RET", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0xdd,
      0xc9 // RET
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("fffe-ffff");

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(42);
  });

  it("0xCA: JP Z,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xaf, // XOR A
      0xdd,
      0xca,
      0x08,
      0x00, // JP Z,0008H
      0x76, // HALT
      0x3e,
      0xaa, // LD A,AAH
      0x76 // HALT
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0xaa);

    expect(cpu.pc).toBe(0x000a);
    expect(cpu.tacts).toBe(36);
  });

  it("0xCC: CALL Z,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xaf, // XOR A
      0xdd,
      0xcc,
      0x08,
      0x00, // CALL Z,0008H
      0x76, // HALT
      0x3e,
      0x24, // LD A,24H
      0xc9 // RET
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.a).toBe(0x24);

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(53);
  });

  it("0xCE: ADC A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x37, // SCF
      0xdd,
      0xce,
      0x24 // ADC,24H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x37);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0xCF: RST 08", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xdd,
      0xcf // RST 8
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("SP");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.a).toBe(0x12);
    expect(cpu.sp).toBe(0xfffe);
    expect(m.memory[0xfffe]).toBe(0x04);
    expect(m.memory[0xffff]).toBe(0x00);

    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(22);
  });
});

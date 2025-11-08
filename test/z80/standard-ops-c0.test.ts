import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops c0-cf", () => {
  it("0xC0: RET NZ #1", () => {
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
    expect(cpu.tacts).toBe(43);
  });

  it("0xC0: RET NZ #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x00, // LD A,00H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0xb7, // OR A
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
    expect(cpu.a).toBe(0x24);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(54);
  });

  it("0xC1: POP BC", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x52,
      0x23, // LD HL,2352H
      0xe5, // PUSH HL
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

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(31);
  });

  it("0xC2: JP NZ,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xb7, // OR A
      0xc2,
      0x07,
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

    expect(cpu.pc).toBe(0x0009);
    expect(cpu.tacts).toBe(32);
  });

  it("0xC2: JP NZ,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x00, // LD A,00H
      0xb7, // OR A
      0xc2,
      0x07,
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
    expect(cpu.a).toBe(0x00);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(25);
  });

  it("0xC3: JP nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xc3,
      0x06,
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

    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(28);
  });

  it("0xC4: CALL NZ,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xb7, // OR A
      0xc4,
      0x07,
      0x00, // CALL NZ,0007H
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

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(49);
  });

  it("0xC4: CALL NZ,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x00, // LD A,00H
      0xb7, // OR A
      0xc4,
      0x07,
      0x00, // CALL NZ,0007H
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
    expect(cpu.a).toBe(0x00);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(25);
  });

  it("0xC4: CALL NZ,nn #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xc4, // CALL NZ,0002H
      0x10,
      0x00
    ]);
    m.cpu.sp = 0;
    m.cpu.f = 0x00;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("SP");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.pc).toBe(0x0010);
    expect(cpu.stepOutStack.length).toBe(1);
    expect(cpu.stepOutStack[0]).toBe(0x0003);
  });

  it("0xC5: PUSH BC", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x01,
      0x52,
      0x23, // LD BC,2352H
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

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(31);
  });

  it("0xC6: ADD A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
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

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(14);
  });

  it("0xC7: RST 00 #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
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
    expect(m.memory[0xfffe]).toBe(0x03);
    expect(m.memory[0xffff]).toBe(0x00);

    expect(cpu.pc).toBe(0x0000);
    expect(cpu.tacts).toBe(18);

    expect(cpu.stepOutStack.length).toBe(1);
    expect(cpu.stepOutStack[0]).toBe(0x0003);
  });

  it("0xC8: RET Z #1", () => {
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
    expect(cpu.tacts).toBe(43);
  });

  it("0xC8: RET Z #2", () => {
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
    expect(cpu.a).toBe(0x24);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(54);
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
    expect(cpu.tacts).toBe(38);
  });

  it("0xCA: JP Z,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xaf, // XOR A
      0xca,
      0x07,
      0x00, // JP Z,0007H
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

  it("0xCA: JP Z,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xb7, // OR A
      0xca,
      0x07,
      0x00, // JP Z,0007H
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
    expect(cpu.a).toBe(0x16);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(25);
  });

  it("0xCC: CALL Z,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xaf, // XOR A
      0xcc,
      0x07,
      0x00, // CALL Z,0007H
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

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(49);
  });

  it("0xCC: CALL Z,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xb7, // OR A
      0xcc,
      0x07,
      0x00, // CALL Z,0007H
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
    expect(cpu.a).toBe(0x16);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(25);
  });
  
  it("0xCC: CALL Z,nn #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xcc, // CALL Z,0002H
      0x10,
      0x00
    ]);
    m.cpu.sp = 0;
    m.cpu.f = 0x40;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("SP");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.pc).toBe(0x0010);
    expect(cpu.stepOutStack.length).toBe(1);
    expect(cpu.stepOutStack[0]).toBe(0x0003);
  });

  it("0xCD: CALL nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xb7, // OR A
      0xcd,
      0x07,
      0x00, // CALL Z,0007H
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

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(49);

    expect(cpu.stepOutStack.length).toBe(1);
    expect(cpu.stepOutStack[0]).toBe(0x0006);
  });

  it("0xCE: ADC A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0x37, // SCF
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

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0xCF: RST 08", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
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
    expect(m.memory[0xfffe]).toBe(0x03);
    expect(m.memory[0xffff]).toBe(0x00);

    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(18);

    expect(cpu.stepOutStack.length).toBe(1);
    expect(cpu.stepOutStack[0]).toBe(0x0003);
  });
});

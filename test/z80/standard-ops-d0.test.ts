import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops d0-df", () => {
  it("0xD0: RET NC #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0xa7, // AND A
      0xd0, // RET NC
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

  it("0xD0: RET NC #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0x37, // SCF
      0xd0, // RET NC
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

  it("0xD1: POP DE", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x52,
      0x23, // LD HL,2352H
      0xe5, // PUSH HL
      0xd1 // POP DE
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL, DE");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.de).toBe(0x2352);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(31);
  });

  it("0xD2: JP NC,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xa7, // AND A
      0xd2,
      0x07,
      0x00, // JP NC,0007H
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

  it("0xD2: JP NC,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0x37, // SCF
      0xd2,
      0x07,
      0x00, // JP NC,0007H
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

  it("0xD3: OUT (n),A", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xd3,
      0x28 // OUT (N),A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1628);
    expect(m.ioAccessLog[0].value).toBe(0x16);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(18);
  });

  it("0xD4: CALL NC,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xa7, // AND A
      0xd4,
      0x07,
      0x00, // CALL NC,0007H
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

  it("0xD4: CALL NC,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0x37, // SCF
      0xd4,
      0x07,
      0x00, // CALL NC,0007H
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

  it("0xD5: PUSH DE", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x11,
      0x52,
      0x23, // LD DE,2352H
      0xd5, // PUSH DE
      0xe1 // POP HL
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL, DE");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.hl).toBe(0x2352);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(31);
  });

  it("0xD6: SUB A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0xd6,
      0x24 // SUB 24H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x12);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(14);
  });

  it("0xD7: RST 10", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xd7 // RST 10H
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

    expect(cpu.pc).toBe(0x0010);
    expect(cpu.tacts).toBe(18);
  });

  it("0xD8: RET C #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0x37, // SCF
      0xd8, // RET C
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

  it("0xD8: RET C #2", () => {
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
      0xd8, // RET C
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

  it("0xD9: EXX", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xd9 // EXX
    ]);
    m.cpu.bc = 0xabcd;
    m.cpu.bc_ = 0x2345;
    m.cpu.de = 0xbcde;
    m.cpu.de_ = 0x3456;
    m.cpu.hl = 0xcdef;
    m.cpu.hl_ = 0x4567;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0x2345);
    expect(cpu.bc_).toBe(0xabcd);
    expect(cpu.de).toBe(0x3456);
    expect(cpu.de_).toBe(0xbcde);
    expect(cpu.hl).toBe(0x4567);
    expect(cpu.hl_).toBe(0xcdef);

    expect(cpu.pc).toBe(0x0001);
    expect(cpu.tacts).toBe(4);
  });

  it("0xDA: JP C,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0x37, // SCF
      0xda,
      0x07,
      0x00, // JP C,0007H
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

  it("0xDA: JP C,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xb7, // OR A
      0xda,
      0x07,
      0x00, // JP C,0007H
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

  it("0xDB: IN A,(n)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xdb,
      0x34 // IN A,(34H)
    ]);
    m.ioInputSequence.push(0xd5);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0xd5);

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x1634);
    expect(m.ioAccessLog[0].value).toBe(0xd5);
    expect(m.ioAccessLog[0].isOutput).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(18);
  });

  it("0xDC: CALL C,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0x37, // SCF
      0xdc,
      0x07,
      0x00, // CALL C,0007H
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

  it("0xDC: CALL C,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x16, // LD A,16H
      0xb7, // OR A
      0xdc,
      0x07,
      0x00, // CALL C,0007H
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

  it("0xDE: SBC A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x36, // LD A,36H
      0x37, // SCF
      0xde,
      0x24 // SBC 24H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x11);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0xDF: RST 18", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xdf // RST 18H
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

    expect(cpu.pc).toBe(0x0018);
    expect(cpu.tacts).toBe(18);
  });
});

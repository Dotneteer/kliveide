import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops f0-ff", () => {
  it("0xF0: RET P #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x32, // LD A,32H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0x87, // ADD A
      0xf0, // RET P
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
    expect(cpu.a).toBe(0x64);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(43);
  });

  it("0xF0: RET P #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0xc0, // LD A,C0H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0x87, // ADD A
      0xf0, // RET P
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

  it("0xF1: POP AF", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x01,
      0x52,
      0x23, // LD BC,2352H
      0xc5, // PUSH BC
      0xf1 // POP AF
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, BC");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.af).toBe(0x2352);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(31);
  });

  it("0xF2: JP P,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x32, // LD A,32H
      0x87, // ADD A
      0xf2,
      0x07,
      0x00, // JP P,0007H
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

  it("0xF2: JP P,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0xc0, // LD A,C0H
      0x87, // ADD A
      0xf2,
      0x07,
      0x00, // JP P,0007H
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
    expect(cpu.a).toBe(0x80);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(25);
  });

  it("0xF3: DI", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xf3 // DI
    ]);
    m.cpu.iff1 = true;
    m.cpu.iff2 = true;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.iff1).toBe(false);
    expect(cpu.iff2).toBe(false);

    expect(cpu.pc).toBe(0x0001);
    expect(cpu.tacts).toBe(4);
  });

  it("0xF4: CALL P,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x32, // LD A,32H
      0x87, // ADD A
      0xf4,
      0x07,
      0x00, // CALL P,0007H
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

  it("0xF4: CALL P,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0xc0, // LD A,C0H
      0x87, // ADD A
      0xf4,
      0x07,
      0x00, // CALL P,0007H
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
    expect(cpu.a).toBe(0x80);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(25);
  });

  it("0xF4: CALL P,nn #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xf4, // CALL P,0010H
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

  it("0xF5: PUSH AF", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xf5, // PUSH AF
      0xc1 // POP BC
    ]);
    m.cpu.sp = 0;
    m.cpu.af = 0x3456;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("HL, BC");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.bc).toBe(0x3456);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(21);
  });

  it("0xF6: OR A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xf6,
      0x23 // OR 23H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x33);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(14);
  });

  it("0xF7: RST 30", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xf7 // RST 30H
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

    expect(cpu.pc).toBe(0x0030);
    expect(cpu.tacts).toBe(18);

    expect(cpu.stepOutStack.length).toBe(1);
    expect(cpu.stepOutStack[0]).toBe(0x0003);
  });

  it("0xF9: LD SP,HL", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x00,
      0x10, // LD HL,1000H
      0xf9 // LD SP,HL
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("SP, HL");
    m.shouldKeepMemory();
    expect(cpu.sp).toBe(0x1000);

    expect(cpu.pc).toBe(0x004);
    expect(cpu.tacts).toBe(16);
  });

  it("0xF8: RET M #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0xc0, // LD A,C0H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0x87, // ADD A
      0xf8, // RET M
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
    expect(cpu.a).toBe(0x80);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(43);
  });

  it("0xF8: RET M #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x32, // LD A,32H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0x87, // ADD A
      0xf8, // RET M
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

  it("0xFA: JP M,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0xc0, // LD A,C0H
      0x87, // ADD A
      0xfa,
      0x07,
      0x00, // JP M,0007H
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

  it("0xFA: JP M,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x32, // LD A,32H
      0x87, // ADD A
      0xfa,
      0x07,
      0x00, // JP M,0007H
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
    expect(cpu.a).toBe(0x64);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(25);
  });

  it("0xFB: EI", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xfb // EI
    ]);
    m.cpu.iff1 = false;
    m.cpu.iff2 = false;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.iff1).toBe(true);
    expect(cpu.iff2).toBe(true);

    expect(cpu.pc).toBe(0x0001);
    expect(cpu.tacts).toBe(4);
  });

  it("0xFC: CALL M,nn #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0xc0, // LD A,C0H
      0x87, // ADD A
      0xfc,
      0x07,
      0x00, // CALL M,0007H
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

  it("0xFC: CALL M,nn #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x32, // LD A,32H
      0x87, // ADD A
      0xfc,
      0x07,
      0x00, // CALL M,0007H
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
    expect(cpu.a).toBe(0x64);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(25);
  });

  it("0xFC: CALL M,nn #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xfc, // CALL M,0010H
      0x10,
      0x00
    ]);
    m.cpu.sp = 0;
    m.cpu.f = 0xff;

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

  it("0xFE: CP A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xfe,
      0x24 // CP 24H
    ]);
    m.cpu.a = 0x36;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(7);
  });

  it("0xFF: RST 38", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xff // RST 38H
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

    expect(cpu.pc).toBe(0x0038);
    expect(cpu.tacts).toBe(18);

    expect(cpu.stepOutStack.length).toBe(1);
    expect(cpu.stepOutStack[0]).toBe(0x0003);
  });
});

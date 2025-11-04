import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed IY ops f0-ff", () => {
  it("0xF0: RET P", () => {
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
      0xfd,
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
    expect(cpu.tacts).toBe(47);
  });

  it("0xF1: POP AF", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x01,
      0x52,
      0x23, // LD BC,2352H
      0xc5, // PUSH BC
      0xfd,
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

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(35);
  });

  it("0xF2: JP P,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x32, // LD A,32H
      0x87, // ADD A
      0xfd,
      0xf2,
      0x08,
      0x00, // JP P,0008H
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

  it("0xF3: DI", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xfd,
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

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0xF4: CALL P,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x32, // LD A,32H
      0x87, // ADD A
      0xfd,
      0xf4,
      0x08,
      0x00, // CALL P,0008H
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

  it("0xF5: PUSH AF", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xfd,
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

    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(25);
  });

  it("0xF6: OR A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
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

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0xF7: RST 30", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
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
    expect(m.memory[0xfffe]).toBe(0x04);
    expect(m.memory[0xffff]).toBe(0x00);

    expect(cpu.pc).toBe(0x0030);
    expect(cpu.tacts).toBe(22);
  });

  it("0xF8: RET M", () => {
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
      0xfd,
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
    expect(cpu.tacts).toBe(47);
  });

  it("0xF9: LD SP,IY", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xfd,
      0x21,
      0x00,
      0x10, // LD IY,1000H
      0xfd,
      0xf9 // LD SP,IY
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("SP, IY");
    m.shouldKeepMemory();
    expect(cpu.sp).toBe(0x1000);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(24);
  });

  it("0xFA: JP M,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0xc0, // LD A,C0H
      0x87, // ADD A
      0xfd,
      0xfa,
      0x08,
      0x00, // JP M,0008H
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

  it("0xFB: EI", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xfd,
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

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(8);
  });

  it("0xFC: CALL M,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0xc0, // LD A,C0H
      0x87, // ADD A
      0xfd,
      0xfc,
      0x08,
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

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(53);
  });

  it("0xFE: CP A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xfd,
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

    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0xFF: RST 38", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xfd,
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
    expect(m.memory[0xfffe]).toBe(0x04);
    expect(m.memory[0xffff]).toBe(0x00);

    expect(cpu.pc).toBe(0x0038);
    expect(cpu.tacts).toBe(22);
  });
});

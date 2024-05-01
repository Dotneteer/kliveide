import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops e0-ef", () => {
  it("0xE0: RET PO", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x2a, // LD A,2AH
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0x87, // ADD A
      0xdd,
      0xe0, // RET PO
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
    expect(cpu.a).toBe(0x54);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(47);
  });

  it("0xE1: POP IX", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x52,
      0x23, // LD HL,2352H
      0xe5, // PUSH HL
      0xdd,
      0xe1 // POP IX
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX, HL");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.hl).toBe(0x2352);

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(35);
  });

  it("0xE2: JP PO,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x2a, // LD A,2AH
      0x87, // ADD A
      0xdd,
      0xe2,
      0x08,
      0x00, // JP PO,0007H
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

  it("0xE3: EX (SP),IX", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x31,
      0x00,
      0x10, // LD SP, 1000H
      0xdd,
      0x21,
      0x34,
      0x12, // LD IX,1234H
      0xdd,
      0xe3 // EX (SP),IX
    ]);
    m.cpu.sp = 0;
    m.memory[0x1000] = 0x78;
    m.memory[0x1001] = 0x56;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("SP, IX");
    m.shouldKeepMemory("1000-1001");
    expect(cpu.ix).toBe(0x5678);
    expect(m.memory[0x1000]).toBe(0x34);
    expect(m.memory[0x1001]).toBe(0x12);

    expect(cpu.pc).toBe(0x0009);
    expect(cpu.tacts).toBe(47);
  });

  it("0xE4: CALL PO,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x2a, // LD A,2AH
      0x87, // ADD A
      0xdd,
      0xe4,
      0x08,
      0x00, // CALL PO,0008H
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

  it("0xE5: PUSH IX", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x21,
      0x52,
      0x23, // LD IX,2352H
      0xdd,
      0xe5, // PUSH IX
      0xc1 // POP BC
    ]);
    m.cpu.sp = 0;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX, BC");
    m.shouldKeepMemory("fffe-ffff");
    expect(cpu.bc).toBe(0x2352);

    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(39);
  });

  it("0xE6: AND A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xdd,
      0xe6,
      0x23 // AND 23H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x02);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0xE7: RST 20", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xdd,
      0xe7 // RST 20H
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

    expect(cpu.pc).toBe(0x0020);
    expect(cpu.tacts).toBe(22);
  });

  it("0xE8: RET PE", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x88, // LD A,88H
      0xcd,
      0x06,
      0x00, // CALL 0006H
      0x76, // HALT
      0x87, // ADD A
      0xdd,
      0xe8, // RET PE
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
    expect(cpu.a).toBe(0x10);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(47);
  });

  it("0xE9: JP (IX)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x21,
      0x00,
      0x10, // LD IX, 1000H
      0xdd,
      0xe9 // JP (IX)
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX");
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x1000);
    expect(cpu.tacts).toBe(22);
  });

  it("0xEA: JP PE,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x88, // LD A,88H
      0x87, // ADD A
      0xdd,
      0xea,
      0x08,
      0x00, // JP PE,0008H
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

  it("0xEB: EX DE,HL", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x34,
      0x12, // LD HL,1234H
      0x11,
      0x78,
      0x56, // LD DE,5678H
      0xdd,
      0xeb // EX DE,HL
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("DE, HL");
    m.shouldKeepMemory();
    expect(cpu.de).toBe(0x1234);
    expect(cpu.hl).toBe(0x5678);

    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(28);
  });

  it("0xEC: CALL PE,nn", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilHalt);
    m.initCode([
      0x3e,
      0x88, // LD A,88H
      0x87, // ADD A
      0xdd,
      0xec,
      0x08,
      0x00, // CALL PE,0008H
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

  it("0xEE: XOR A,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xdd,
      0xee,
      0x23 // XOR 23H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    expect(cpu.a).toBe(0x31);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(18);
  });

  it("0xEF: RST 28", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x3e,
      0x12, // LD A,12H
      0xdd,
      0xef // RST 28H
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

    expect(cpu.pc).toBe(0x0028);
    expect(cpu.tacts).toBe(22);
  });
});

import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";
import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";

class DaaSample {
  constructor (
    public readonly a: number,
    public readonly h: boolean,
    public readonly n: boolean,
    public readonly c: boolean,
    public readonly af: number
  ) {}
}

describe("Z80 IX indexed ops 20-2f", () => {
  it("0x20: jrnz", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x01, // LD A,01H
      0x3d, // DEC A
      0xdd,
      0x20,
      0x02 // JR NZ,02H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0x21: ld IX,NN", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xdd,
      0x21,
      0x26,
      0xa9 // LD HL,A926H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX");
    m.shouldKeepMemory();

    expect(cpu.ix).toBe(0xa926);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(14);
  });

  it("0x22: ld (NN),ix", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x21,
      0x26,
      0xa9, // LD IX,A926H
      0xdd,
      0x22,
      0x00,
      0x10 // LD (1000H),IX
    ]);

    // --- Act
    const lBefore = m.memory[0x1000];
    const hBefore = m.memory[0x1001];
    m.run();
    const lAfter = m.memory[0x1000];
    const hAfter = m.memory[0x1001];

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX");
    m.shouldKeepMemory("1000-1001");

    expect(cpu.ix).toBe(0xa926);
    expect(lBefore).toBe(0x00);
    expect(hBefore).toBe(0x00);
    expect(lAfter).toBe(0x26);
    expect(hAfter).toBe(0xa9);
    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(34);
  });

  it("0x23: inc ix", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x21,
      0x26,
      0xa9, // LD IX,A926H
      0xdd,
      0x23 // INC IX
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX");
    m.shouldKeepMemory();

    expect(cpu.ix).toBe(0xa927);
    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(24);
  });

  it("0x24: inc xh", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x26,
      0x43, // LD XH,43H
      0xdd,
      0x24 // INC XH
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.xh).toBe(0x44);
    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(19);
  });

  it("0x25: dec xh", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x26,
      0x43, // LD XH,43H
      0xdd,
      0x25 // DEC XH
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.xh).toBe(0x42);
    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(19);
  });

  it("0x26: ld xh,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x26,
      0x26 // LD XH,26H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX");
    m.shouldKeepMemory();

    expect(cpu.xh).toBe(0x26);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  const daaSamples = [
    new DaaSample(0x99, false, false, false, 0x998c),
    new DaaSample(0x99, true, false, false, 0x9f8c),
    new DaaSample(0x7a, false, false, false, 0x8090),
    new DaaSample(0x7a, true, false, false, 0x8090),
    new DaaSample(0xa9, false, false, false, 0x090d),
    new DaaSample(0x87, false, false, true, 0xe7a5),
    new DaaSample(0x87, true, false, true, 0xedad),
    new DaaSample(0x1b, false, false, true, 0x8195),
    new DaaSample(0x1b, true, false, true, 0x8195),
    new DaaSample(0xaa, false, false, false, 0x1011),
    new DaaSample(0xaa, true, false, false, 0x1011),
    new DaaSample(0xc6, true, false, false, 0x2c29)
  ];

  daaSamples.forEach((sample, index) =>
    it(`0x27: daa #${index}`, () => {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.UntilEnd);
      m.initCode([
        0xdd,
        0x27 // DAA
      ]);
      m.cpu.a = sample.a;
      m.cpu.f =
        (sample.h ? FlagsSetMask.H : 0) |
        (sample.n ? FlagsSetMask.N : 0) |
        (sample.c ? FlagsSetMask.C : 0);

      // --- Act
      m.run();

      // --- Assert
      const cpu = m.cpu;
      m.shouldKeepRegisters("AF");
      m.shouldKeepMemory();

      expect(cpu.af).toBe(sample.af);
      expect(cpu.pc).toBe(0x0002);
      expect(cpu.tacts).toBe(8);
    })
  );

  it("0x28: jrz (jump)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x01, // LD A,01H
      0x3d, // DEC A
      0xdd,
      0x28,
      0x02 // JR Z,02H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0008);
    expect(cpu.tacts).toBe(27);
  });

  it("0x29: add ix,ix #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x21,
      0x34,
      0x12, // LD IX,1234H
      0xdd,
      0x29 // ADD IX,IX
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, IX");
    m.shouldKeepMemory();
    m.shouldKeepSFlag();
    m.shouldKeepZFlag();
    m.shouldKeepPVFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);

    expect(cpu.ix).toBe(0x2468);
    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(29);
  });

  it("0x2a: ld ix,(NN)", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x2a,
      0x00,
      0x10 // LD HL,(1000H)
    ]);
    m.memory[0x1000] = 0x34;
    m.memory[0x1001] = 0x12;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX");
    m.shouldKeepMemory();

    expect(cpu.ix).toBe(0x1234);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(20);
  });

  it("0x2b: dec ix", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x21,
      0x26,
      0xa9, // LD IX,A926H
      0xdd,
      0x2b // DEC IX
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX");
    m.shouldKeepMemory();

    expect(cpu.ix).toBe(0xa925);
    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(24);
  });

  it("0x2c: inc xl", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x2e,
      0x43, // LD XL,43H
      0xdd,
      0x2c // INC XL
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.xl).toBe(0x44);
    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(19);
  });

  it("0x2d: dec xl", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x2e,
      0x43, // LD XL,43H
      0xdd,
      0x2d // DEC XL
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.xl).toBe(0x42);
    expect(cpu.pc).toBe(0x0005);
    expect(cpu.tacts).toBe(19);
  });

  it("0x2e: ld xl,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0xdd,
      0x2e,
      0x26 // LD XL,26H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("IX");
    m.shouldKeepMemory();

    expect(cpu.xl).toBe(0x26);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x2f: cpl", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x81, // LD A,81H
      0xdd,
      0x2f // CPL
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF");
    m.shouldKeepMemory();
    m.shouldKeepSFlag();
    m.shouldKeepZFlag();
    m.shouldKeepPVFlag();
    m.shouldKeepCFlag();
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.a).toBe(0x7e);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(15);
  });
});

import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 extended ops a0-af", () => {
  it("0xA0: LDI #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa0 // LDI
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x1001;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.de] = 0x11;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, DE, HL");
    m.shouldKeepMemory("1001");

    expect(m.memory[0x1001]).toBe(0xa5);
    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x1001);
    expect(cpu.de).toBe(0x1002);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA0: LDI #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa0 // LDI
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0001;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x1001;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.de] = 0x11;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, DE, HL");
    m.shouldKeepMemory("1001");

    expect(m.memory[0x1001]).toBe(0xa5);
    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x1001);
    expect(cpu.de).toBe(0x1002);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA1: CPI #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa1 // CPI
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.a &= 0x11;
    m.memory[m.cpu.hl] = 0xa5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA1: CPI #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa1 // CPI
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0001;
    m.cpu.hl = 0x1000;
    m.cpu.a = 0x11;
    m.memory[m.cpu.hl] = 0xa5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA1: CPI #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa1 // CPI
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.a = 0xa5;
    m.memory[m.cpu.hl] = 0xa5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA1: CPI #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa1 // CPI
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0001;
    m.cpu.hl = 0x1000;
    m.cpu.a = 0xa5;
    m.memory[m.cpu.hl] = 0xa5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA2: INI #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa2 // INI
    ]);
    m.cpu.bc = 0x10cc;
    m.cpu.hl = 0x1000;
    m.ioInputSequence.push(0x69);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory("1000");

    expect(m.memory[0x1000]).toBe(0x69);
    expect(cpu.b).toBe(0x0f);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA2: INI #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa2 // INI
    ]);
    m.cpu.bc = 0x01cc;
    m.cpu.hl = 0x1000;
    m.ioInputSequence.push(0x69);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory("1000");

    expect(m.memory[0x1000]).toBe(0x69);
    expect(cpu.b).toBe(0x00);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA3: OUTI #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa3 // OUTI
    ]);
    m.cpu.bc = 0x10cc;
    m.cpu.hl = 0x1000;
    m.memory[m.cpu.hl] = 0x29;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory("1000");

    expect(cpu.b).toBe(0x0f);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x0fcc);
    expect(m.ioAccessLog[0].value).toBe(0x29);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA3: OUTI #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa3 // OUTI
    ]);
    m.cpu.bc = 0x01cc;
    m.cpu.hl = 0x1000;
    m.memory[m.cpu.hl] = 0x29;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory("1000");

    expect(cpu.b).toBe(0x00);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x1001);

    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x00cc);
    expect(m.ioAccessLog[0].value).toBe(0x29);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA8: LDD #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa8 // LDD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x1001;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.de] = 0x11;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, DE, HL");
    m.shouldKeepMemory("1001");

    expect(m.memory[0x1001]).toBe(0xa5);
    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x0fff);
    expect(cpu.de).toBe(0x1000);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA8: LDD #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa8 // LDD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0001;
    m.cpu.hl = 0x1000;
    m.cpu.de = 0x1001;
    m.memory[m.cpu.hl] = 0xa5;
    m.memory[m.cpu.de] = 0x11;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, DE, HL");
    m.shouldKeepMemory("1001");

    expect(m.memory[0x1001]).toBe(0xa5);
    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x0fff);
    expect(cpu.de).toBe(0x1000);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA9: CPD #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa9 // CPD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.a &= 0x11;
    m.memory[m.cpu.hl] = 0xa5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x0fff);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA9: CPD #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa9 // CPD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0001;
    m.cpu.hl = 0x1000;
    m.cpu.a &= 0x11;
    m.memory[m.cpu.hl] = 0xa5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x0fff);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA9: CPD #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa9 // CPD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0010;
    m.cpu.hl = 0x1000;
    m.cpu.a &= 0xa5;
    m.memory[m.cpu.hl] = 0xa5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0x000f);
    expect(cpu.hl).toBe(0x0fff);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xA9: CPD #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xa9 // CPD
    ]);
    m.cpu.f &= 0xfe;
    m.cpu.bc = 0x0001;
    m.cpu.hl = 0x1000;
    m.cpu.a &= 0xa5;
    m.memory[m.cpu.hl] = 0xa5;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0x0000);
    expect(cpu.hl).toBe(0x0fff);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(true);
    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xAA: IND #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xaa // IND
    ]);
    m.cpu.bc = 0x10cc;
    m.cpu.hl = 0x1000;
    m.ioInputSequence.push(0x69);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory("1000");

    expect(m.memory[0x1000]).toBe(0x69);
    expect(cpu.b).toBe(0x0f);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x0fff);

    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xAA: IND #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xaa // IND
    ]);
    m.cpu.bc = 0x01cc;
    m.cpu.hl = 0x1000;
    m.ioInputSequence.push(0x69);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory("1000");

    expect(m.memory[0x1000]).toBe(0x69);
    expect(cpu.b).toBe(0x00);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x0fff);

    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xAB: OUTD #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xab // OUTD
    ]);
    m.cpu.bc = 0x10cc;
    m.cpu.hl = 0x1000;
    m.memory[m.cpu.hl] = 0x29;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory("1000");

    expect(cpu.b).toBe(0x0f);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x0fff);

    expect(cpu.isZFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x0fcc);
    expect(m.ioAccessLog[0].value).toBe(0x29);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });

  it("0xAB: OUTD #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0xed,
      0xab // OUTD
    ]);
    m.cpu.bc = 0x01cc;
    m.cpu.hl = 0x1000;
    m.memory[m.cpu.hl] = 0x29;

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory("1000");

    expect(cpu.b).toBe(0x00);
    expect(cpu.c).toBe(0xcc);
    expect(cpu.hl).toBe(0x0fff);

    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.isNFlagSet()).toBe(false);
    expect(cpu.isCFlagSet()).toBe(true);

    expect(m.ioAccessLog.length).toBe(1);
    expect(m.ioAccessLog[0].address).toBe(0x00cc);
    expect(m.ioAccessLog[0].value).toBe(0x29);
    expect(m.ioAccessLog[0].isOutput).toBe(true);

    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(16);
  });
});

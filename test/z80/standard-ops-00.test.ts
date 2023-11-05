import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops 00-0f", () => {
  it("0x00: nop", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x00 // NOP
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters();
    m.shouldKeepMemory();

    expect(cpu.pc).toBe(0x0001);
    expect(cpu.tacts).toBe(4);
  });

  it("0x01: ld bc,NN", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x01,
      0x26,
      0xa9 // LD BC,A926H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0xa926);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(10);
  });

  it("0x02: ld (bc),a", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x01,
      0x26,
      0xa9, // LD BC,A926H
      0x3e,
      0x94, // LD A,94H
      0x02 // LD (BC),A
    ]);

    // --- Act
    const valueBefore = m.memory[0xa926];
    m.run();
    const valueAfter = m.memory[0xa926];

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, A");
    m.shouldKeepMemory("A926");

    expect(cpu.bc).toBe(0xa926);
    expect(cpu.a).toBe(0x94);
    expect(cpu.wh).toBe(0x94);
    expect(valueBefore).toBe(0);
    expect(valueAfter).toBe(0x94);
    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(24);
  });

  it("0x03: inc bc", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x01,
      0x26,
      0xa9, // LD BC,A926H
      0x03 // INC BC
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0xa927);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(16);
  });

  it("0x04: inc b #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0x43, // LD B,43H
      0x04 // INC B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.b).toBe(0x44);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x04: inc b #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0xff, // LD B,FFH
      0x04 // INC B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.b).toBe(0x00);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x04: inc b #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0x7f, // LD B,7FH
      0x04 // INC B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.b).toBe(0x80);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x04: inc b #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0x2f, // LD B,2FH
      0x04 // INC B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.b).toBe(0x30);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x05: dec b #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0x43, // LD B,43H
      0x05 // DEC B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.b).toBe(0x42);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x05: dec b #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0x01, // LD B,01H
      0x05 // DEC B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.b).toBe(0x00);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x05: dec b #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0x80, // LD B,80H
      0x05 // DEC B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.b).toBe(0x7f);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x05: dec b #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0x20, // LD B,20H
      0x05 // DEC B
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.b).toBe(0x1f);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x06: ld b,N", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x06,
      0x26 // LD B,26H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("B");
    m.shouldKeepMemory();

    expect(cpu.b).toBe(0x26);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(7);
  });

  it("0x07: rlca #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x71, // LD A,71H
      0x07 // RLCA
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
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.a).toBe(0xe2);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x07: rlca #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x80, // LD A,80H
      0x07 // RLCA
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
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(true);

    expect(cpu.a).toBe(0x01);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x08: ex af,af'", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x34, // LD A,34H
      0x08, // EX AF,AF'
      0x3e,
      0x56, // LD A,56H
      0x08 // EX AF,AF'
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("AF, AF'");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0x34);
    expect(cpu.pc).toBe(0x0006);
    expect(cpu.tacts).toBe(22);
  });

  it("0x09: add hl,bc #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x34,
      0x12, // LD HL,1234H
      0x01,
      0x02,
      0x11, // LD BC,1102H
      0x09 // ADD HL,BC
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();
    m.shouldKeepSFlag();
    m.shouldKeepZFlag();
    m.shouldKeepPVFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(false);
    expect(cpu.isHFlagSet()).toBe(false);

    expect(cpu.hl).toBe(0x2336);
    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(31);
  });

  it("0x09: add hl,bc #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x21,
      0x34,
      0xf2, // LD HL,F234H
      0x01,
      0x02,
      0x11, // LD BC,1102H
      0x09 // ADD HL,BC
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("F, BC, HL");
    m.shouldKeepMemory();
    m.shouldKeepSFlag();
    m.shouldKeepZFlag();
    m.shouldKeepPVFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(true);
    expect(cpu.isHFlagSet()).toBe(false);

    expect(cpu.hl).toBe(0x0336);
    expect(cpu.pc).toBe(0x0007);
    expect(cpu.tacts).toBe(31);
  });

  it("0x0a: ld a,(bc) ", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x01,
      0x03,
      0x00, // LD BC,0003H
      0x0a // LD A,(BC)
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC, A");
    m.shouldKeepMemory();

    expect(cpu.a).toBe(0x0a);
    expect(cpu.wz).toBe(0x0004);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(17);
  });

  it("0x0b: dec bc ", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x01,
      0x26,
      0xa9, // LD BC,A926H
      0x0b // DEC BC
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("BC");
    m.shouldKeepMemory();

    expect(cpu.bc).toBe(0xa925);
    expect(cpu.pc).toBe(0x0004);
    expect(cpu.tacts).toBe(16);
  });

  it("0x0c: inc c #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0x43, // LD C,43H
      0x0c // INC C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.c).toBe(0x44);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x0c: inc c #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0xff, // LD C,FFH
      0x0c // INC C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.c).toBe(0x00);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x0c: inc c #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0x7f, // LD C,7FH
      0x0c // INC C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isSFlagSet()).toBe(true);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.c).toBe(0x80);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x0c: inc c #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0x2f, // LD C,2FH
      0x0c // INC C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.c).toBe(0x30);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x0d: dec c #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0x43, // LD C,43H
      0x0d // DEC C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.c).toBe(0x42);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x0d: dec c #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0x01, // LD C,01H
      0x0d // DEC C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.isZFlagSet()).toBe(true);
    expect(cpu.c).toBe(0x00);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x0d: dec c #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0x80, // LD C,80H
      0x0d // DEC C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.isSFlagSet()).toBe(false);
    expect(cpu.isPvFlagSet()).toBe(true);
    expect(cpu.c).toBe(0x7f);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x0d: dec c #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0x20, // LD C,20H
      0x0d // DEC C
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C, F");
    m.shouldKeepMemory();
    m.shouldKeepCFlag();
    expect(cpu.isNFlagSet()).toBe(true);

    expect(cpu.isHFlagSet()).toBe(true);
    expect(cpu.c).toBe(0x1f);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x0e: ld c,N ", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x0e,
      0x26 // LD C,26H
    ]);

    // --- Act
    m.run();

    // --- Assert
    const cpu = m.cpu;
    m.shouldKeepRegisters("C");
    m.shouldKeepMemory();

    expect(cpu.c).toBe(0x26);
    expect(cpu.pc).toBe(0x0002);
    expect(cpu.tacts).toBe(7);
  });

  it("0x0f: rrca #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x70, // LD A,70H
      0x0f // RRCA
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
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(false);

    expect(cpu.a).toBe(0x38);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });

  it("0x0f: rrca #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x3e,
      0x41, // LD A,01H
      0x0f // RRCA
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
    expect(cpu.isHFlagSet()).toBe(false);
    expect(cpu.isNFlagSet()).toBe(false);

    expect(cpu.isCFlagSet()).toBe(true);

    expect(cpu.a).toBe(0xa0);
    expect(cpu.pc).toBe(0x0003);
    expect(cpu.tacts).toBe(11);
  });
});

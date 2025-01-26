import { describe, it, expect } from "vitest";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 memory operation test", () => {
  it("Instruction read #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([
      0x00 // NOP
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0000);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0x3a,
      0x55,
      0xaa // LD A,(0xAA55)
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(4);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0xaa55);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0x3a,
      0x55,
      0xaa, // LD A,(0xAA55)
      0x00 // NOP
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0004);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0x2a,
      0x55,
      0xaa // LD HL,(0xAA55)
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(5);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0xaa55);
    expect(lastRead[4]).toBe(0xaa56);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #5", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0x2a,
      0x55,
      0xaa, // LD HL,(0xAA55)
      0x00 // NOP
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0004);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #6", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xed,
      0x6b,
      0x55,
      0xaa // LD HL,(0xAA55)
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(6);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0x0004);
    expect(lastRead[4]).toBe(0xaa55);
    expect(lastRead[5]).toBe(0xaa56);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #7", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xed,
      0x6b,
      0x55,
      0xaa, // LD HL,(0xAA55)
      0x00 // NOP
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0005);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #8", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xcb,
      0x46 // BIT 0,(HL)
    ]);

    // --- Act
    m.cpu.hl = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(3);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0xaa55);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #9", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xcb,
      0x46, // BIT 0,(HL)
      0x00 // NOP
    ]);

    // --- Act
    m.cpu.hl = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0003);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #10", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xdd,
      0x46,
      0x02 // LD B,(IX+2)
    ]);

    // --- Act
    m.cpu.ix = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(4);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0xaa57);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #11", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xdd,
      0x46,
      0x02, // LD B,(IX+2)
      0x00 // NOP
    ]);

    // --- Act
    m.cpu.ix = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0004);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #12", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xfd,
      0x46,
      0x02 // LD B,(IY+2)
    ]);

    // --- Act
    m.cpu.iy = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(4);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0xaa57);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #13", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xfd,
      0x46,
      0x02, // LD B,(IY+2)
      0x00 // NOP
    ]);

    // --- Act
    m.cpu.iy = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0004);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #14", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xdd,
      0xcb,
      0x02,
      0x46 // BIT 0,(IX+2)
    ]);

    // --- Act
    m.cpu.ix = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(5);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0x0004);
    expect(lastRead[4]).toBe(0xaa57);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #15", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xdd,
      0xcb,
      0x02,
      0x46, // BIT 0,(IX+2)
      0x00 // NOP
    ]);

    // --- Act
    m.cpu.ix = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0005);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #16", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xfd,
      0xcb,
      0x02,
      0x46 // BIT 0,(IY+2)
    ]);

    // --- Act
    m.cpu.iy = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(5);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0x0004);
    expect(lastRead[4]).toBe(0xaa57);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction read #17", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([0x00, 0xfd, 0xcb, 0x02, 0x46, 0x00]);

    // --- Act
    m.cpu.iy = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0005);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction write #1", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0x02 // LD (BC),A
    ]);

    // --- Act
    m.cpu.bc = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastWrite.length).toBe(1);
    expect(lastWrite[0]).toBe(0xaa55);
  });

  it("Instruction write #2", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0x32, 0x55, 0xaa // LD (0xAA55),A
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(3);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastWrite.length).toBe(1);
    expect(lastWrite[0]).toBe(0xaa55);
  });

  it("Instruction write #3", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0x22, 0x55, 0xaa // LD (0xAA55),HL
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(3);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastWrite.length).toBe(2);
    expect(lastWrite[0]).toBe(0xaa55);
    expect(lastWrite[1]).toBe(0xaa56);
  });

  it("Instruction write #4", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0x22, 0x55, 0xaa, // LD (0xAA55),HL
      0x00 // NOP
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0004);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction write #5", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xed, 0x63, 0x55, 0xaa // LD (0xAA55),HL
    ]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(4);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0x0004);
    expect(lastWrite.length).toBe(2);
    expect(lastWrite[0]).toBe(0xaa55);
    expect(lastWrite[1]).toBe(0xaa56);
  });

  it("Instruction write #6", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([0x00, 0xed, 0x63, 0x55, 0xaa, 0x00]);

    // --- Act
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0005);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction write #7", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xcb, 0xf6, // SET 6,(HL)
    ]);

    // --- Act
    m.cpu.hl = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;

    expect(lastRead.length).toBe(3);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0xaa55);
    expect(lastWrite.length).toBe(1);
    expect(lastWrite[0]).toBe(0xaa55);
  });

  it("Instruction write #8", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([0x00, 0xcb, 0xf6, 0x00]);

    // --- Act
    m.cpu.hl = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0003);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction write #9", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xdd, 0x70, 0x02 // LD (IX+2),B
    ]);

    // --- Act
    m.cpu.ix = 0xaa55;
    m.cpu.b = 0x23;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(3);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastWrite.length).toBe(1);
    expect(lastWrite[0]).toBe(0xaa57);
  });

  it("Instruction write #10", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xdd, 0x70, 0x02, // LD (IX+2),B
      0x00, // NOP
    ]);

    // --- Act
    m.cpu.ix = 0xaa55;
    m.cpu.b = 0x23;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0004);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction write #11", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xfd, 0x70, 0x02, // LD (IY+2),B
    ]);

    // --- Act
    m.cpu.iy = 0xaa55;
    m.cpu.b = 0x23;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(3);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastWrite.length).toBe(1);
    expect(lastWrite[0]).toBe(0xaa57);
  });

  it("Instruction write #12", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xfd, 0x70, 0x02, // LD (IY+2),B
      0x00, // NOP
    ]);

    // --- Act
    m.cpu.iy = 0xaa55;
    m.cpu.b = 0x23;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0004);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction write #13", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xdd, 0xcb, 0x02, 0x06 // RLC (IX+2)
    ]);

    // --- Act
    m.cpu.ix = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(5);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0x0004);
    expect(lastRead[4]).toBe(0xaa57);
    expect(lastWrite.length).toBe(1);
    expect(lastWrite[0]).toBe(0xaa57);
  });

  it("Instruction write #14", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xdd, 0xcb, 0x02, 0x06, // RLC (IX+2)
      0x00, // NOP
    ]);

    // --- Act
    m.cpu.ix = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0005);
    expect(lastWrite.length).toBe(0);
  });

  it("Instruction write #15", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xfd, 0xcb, 0x02, 0x06, // RLC (IY+2)
    ]);

    // --- Act
    m.cpu.iy = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(5);
    expect(lastRead[0]).toBe(0x0001);
    expect(lastRead[1]).toBe(0x0002);
    expect(lastRead[2]).toBe(0x0003);
    expect(lastRead[3]).toBe(0x0004);
    expect(lastRead[4]).toBe(0xaa57);
    expect(lastWrite.length).toBe(1);
    expect(lastWrite[0]).toBe(0xaa57);
  });

  it("Instruction write #16", () => {
    // --- Arrange
    const m = new Z80TestMachine(RunMode.UntilEnd);
    m.initCode([
      0x00, // NOP
      0xfd, 0xcb, 0x02, 0x06, // RLC (IY+2)
      0x00 // NOP
    ]);

    // --- Act
    m.cpu.iy = 0xaa55;
    m.run();

    // --- Assert
    const lastRead = m.cpu.lastMemoryReads;
    const lastWrite = m.cpu.lastMemoryWrites;
    expect(lastRead.length).toBe(1);
    expect(lastRead[0]).toBe(0x0005);
    expect(lastWrite.length).toBe(0);
  });
});

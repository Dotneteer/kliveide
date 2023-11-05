import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 reset ops 80-bf", () => {
  it("RES n,B #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x80 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,B
      ]);

      m.cpu.b = 0xff;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("B");
      m.shouldKeepMemory();

      expect(m.cpu.b).toBe(0xff & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,B #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x80 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,B
      ]);

      m.cpu.b = 0xaa;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("B");
      m.shouldKeepMemory();

      expect(m.cpu.b).toBe(0xaa & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,C #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x81 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,C
      ]);

      m.cpu.c = 0xff;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("C");
      m.shouldKeepMemory();

      expect(m.cpu.c).toBe(0xff & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,C #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x81 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,C
      ]);

      m.cpu.c = 0xaa;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("C");
      m.shouldKeepMemory();

      expect(m.cpu.c).toBe(0xaa & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,D #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x82 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,D
      ]);

      m.cpu.d = 0xff;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("D");
      m.shouldKeepMemory();

      expect(m.cpu.d).toBe(0xff & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,D #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x82 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,D
      ]);

      m.cpu.d = 0xaa;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("D");
      m.shouldKeepMemory();

      expect(m.cpu.d).toBe(0xaa & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,E #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x83 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,E
      ]);

      m.cpu.e = 0xff;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("E");
      m.shouldKeepMemory();

      expect(m.cpu.e).toBe(0xff & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,E #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x83 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,E
      ]);

      m.cpu.e = 0xaa;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("E");
      m.shouldKeepMemory();

      expect(m.cpu.e).toBe(0xaa & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,H #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x84 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,H
      ]);

      m.cpu.h = 0xff;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("H");
      m.shouldKeepMemory();

      expect(m.cpu.h).toBe(0xff & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,H #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x84 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,H
      ]);

      m.cpu.h = 0xaa;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("H");
      m.shouldKeepMemory();

      expect(m.cpu.h).toBe(0xaa & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,L #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x85 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,L
      ]);

      m.cpu.l = 0xff;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("L");
      m.shouldKeepMemory();

      expect(m.cpu.l).toBe(0xff & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,L #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x85 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,L
      ]);

      m.cpu.l = 0xaa;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("L");
      m.shouldKeepMemory();

      expect(m.cpu.l).toBe(0xaa & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,(HL) #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x86 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,(HL)
      ]);

      m.cpu.hl = 0x1000;
      m.memory[m.cpu.hl] = 0xff;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters();
      m.shouldKeepMemory("1000");

      expect(m.memory[m.cpu.hl]).toBe(0xff & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(15);
    }
  });

  it("RES n,(HL) #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x86 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,(HL)
      ]);

      m.cpu.hl = 0x1000;
      m.memory[m.cpu.hl] = 0xaa;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters();
      m.shouldKeepMemory("1000");

      expect(m.memory[m.cpu.hl]).toBe(0xaa & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(15);
    }
  });

  it("RES n,A #1", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x87 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,A
      ]);

      m.cpu.a = 0xff;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("A");
      m.shouldKeepMemory();

      expect(m.cpu.a).toBe(0xff & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });

  it("RES n,A #2", () => {
    for (let n = 0; n < 8; n++) {
      // --- Arrange
      const m = new Z80TestMachine(RunMode.OneInstruction);
      const opcn = 0x87 | (n << 3);

      m.initCode([
        0xcb,
        opcn // RES N,A
      ]);

      m.cpu.a = 0xaa;

      // --- Act
      m.run();

      // --- Assert
      m.shouldKeepRegisters("A");
      m.shouldKeepMemory();

      expect(m.cpu.a).toBe(0xaa & ~(1 << n));

      expect(m.cpu.pc).toBe(0x0002);
      expect(m.cpu.tacts).toBe(8);
    }
  });
});

import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed IY ops 70-7f", () => {
    it("0x70: LD (IY+d),B", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x70, OFFS  // LD (IY+52H),B
        ]);
        m.cpu.iy = 0x1000;
        m.cpu.b = 0xA5;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory("1052");

        expect(m.memory[m.cpu.iy + OFFS]).toBe(0xA5);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x71: LD (IY+d),C", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x71, OFFS  // LD (IY+52H),C
        ]);
        m.cpu.iy = 0x1000;
        m.cpu.c = 0xA5;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory("1052");

        expect(m.memory[m.cpu.iy + OFFS]).toBe(0xA5);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x72: LD (IY+d),D", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x72, OFFS  // LD (IY+52H),D
        ]);
        m.cpu.iy = 0x1000;
        m.cpu.d = 0xA5;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory("1052");

        expect(m.memory[m.cpu.iy + OFFS]).toBe(0xA5);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x73: LD (IY+d),E", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x73, OFFS  // LD (IY+52H),E
        ]);
        m.cpu.iy = 0x1000;
        m.cpu.e = 0xA5;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory("1052");

        expect(m.memory[m.cpu.iy + OFFS]).toBe(0xA5);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x74: LD (IY+d),H", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x74, OFFS  // LD (IY+52H),H
        ]);
        m.cpu.iy = 0x1000;
        m.cpu.h = 0xA5;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory("1052");

        expect(m.memory[m.cpu.iy + OFFS]).toBe(0xA5);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x75: LD (IY+d),L", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x75, OFFS  // LD (IY+52H),L
        ]);
        m.cpu.iy = 0x1000;
        m.cpu.l = 0xA5;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory("1052");

        expect(m.memory[m.cpu.iy + OFFS]).toBe(0xA5);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x76: HALT", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0xFD, 0x76        // HALT
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory();

        expect(cpu.halted).toBe(true);
        expect(cpu.pc).toBe(0x0001);
        expect(cpu.tacts).toBe(8);
    });

    it("0x77: LD (IY+d),A", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x77, OFFS  // LD (IY+52H),A
        ]);
        m.cpu.iy = 0x1000;
        m.cpu.a = 0xA5;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory("1052");

        expect(m.memory[m.cpu.iy + OFFS]).toBe(0xA5);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x78: LD A,B", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0xB9, // LD B,B9H
            0xFD, 0x78  // LD A,B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A, B");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xb9)
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x79: LD A,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x0E, 0xB9, // LD C,B9H
            0xFD, 0x79  // LD A,C
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A, C");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xb9)
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x7A: LD A,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x16, 0xB9, // LD D,B9H
            0xFD, 0x7A  // LD A,D
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A, D");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xb9)
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x7B: LD A,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x1E, 0xB9, // LD E,B9H
            0xFD, 0x7B  // LD A,E
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A, E");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xb9)
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x7C: LD A,XH", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x26, 0xB9, // LD XH,B9H
            0xFD, 0x7C        // LD A,XH
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A, IY");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xb9)
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });

    it("0x7D: LD A,XL", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x2E, 0xB9, // LD XL,B9H
            0xFD, 0x7D        // LD A,XL
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A, IY");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xb9)
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });

    it("0x7E: LD A,(IY+d)", ()=> {
        // --- Arrange
        const OFFS = 0x54;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x7E, OFFS  // LD A,(IY+54H)
        ]);
        m.cpu.iy = 0x1000;
        m.memory[m.cpu.iy + OFFS] = 0x7C;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A, IY");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0x7c)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x7F: LD A,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0xB9, // LD A,B9H
            0xFD, 0x7F  // LD A,A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xb9)
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });
});
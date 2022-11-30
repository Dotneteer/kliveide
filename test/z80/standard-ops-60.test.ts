import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops 60-6f", () => {
    it("0x60: LD H,B", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0xB9, // LD B,B9H
            0x60        // LD H,B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, B");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x61: LD H,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x0E, 0xB9, // LD C,B9H
            0x61        // LD H,C
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, C");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x62: LD H,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x16, 0xB9, // LD D,B9H
            0x62        // LD H,D
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, D");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x63: LD H,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x1E, 0xB9, // LD E,B9H
            0x63        // LD H,E
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, E");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x64: LD H,H", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0xB9, // LD H,B9H
            0x64        // LD H,H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x65: LD H,L", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2E, 0xB9, // LD L,B9H
            0x65        // LD H,L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, L");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x66: LD H,(HL)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x00, 0x10, // LD HL,1000H
            0x66              // LD H,(HL)
        ]);
        m.memory[0x1000] = 0xB9;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0xb9)
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(17);
    });

    it("0x67: LD H,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0xB9, // LD A,B9H
            0x67        // LD H,A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, A");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x68: LD L,B", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0xB9, // LD B,B9H
            0x68        // LD L,B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, B");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x69: LD L,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x0E, 0xB9, // LD C,B9H
            0x69        // LD L,C
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, C");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x6A: LD L,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x16, 0xB9, // LD D,B9H
            0x6A        // LD L,D
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, D");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x6B: LD L,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x1E, 0xB9, // LD E,B9H
            0x6B        // LD L,E
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, E");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x6C: LD L,H", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0xB9, // LD H,B9H
            0x6C        // LD L,H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, H");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x6D: LD L,L", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2E, 0xB9, // LD L,B9H
            0x6D        // LD L,L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x6E: LD L,(HL)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x00, 0x10, // LD HL,1000H
            0x6E              // LD L,(HL)
        ]);
        m.memory[0x1000] = 0xB9;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0xb9)
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(17);
    });

    it("0x6F: LD L,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0xB9, // LD A,B9H
            0x6F        // LD L,A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, A");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0xb9)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });
});
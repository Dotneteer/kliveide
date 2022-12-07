import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed IX ops 60-6f", () => {
    it("0x60: LD XH,B", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0xB9, // LD B,B9H
            0xDD, 0x60  // LD XH,B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX, B");
        m.shouldKeepMemory();

        expect(cpu.xh).toBe(0xb9)
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x61: LD XH,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x61 // LD XH,C
        ]);
        m.cpu.ix = 0xAAAA;
        m.cpu.c = 0x55;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xh).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x62: LD XH,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x62 // LD XH,D
        ]);
        m.cpu.ix = 0xAAAA;
        m.cpu.d = 0x55;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xh).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x63: LD XH,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x63 // LD XH,D
        ]);
        m.cpu.ix = 0xAAAA;
        m.cpu.e = 0x55;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xh).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x64: LD XH,XH", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x64 // LD XH,XH
        ]);
        m.cpu.ix = 0xAAAA;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xh).toBe(0xAA)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x65: LD XH,XL", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x65 // LD XH,XL
        ]);
        m.cpu.ix = 0xAA55;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xh).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x66: LD H,(IX+d)", ()=> {
        // --- Arrange
        const OFFS = 0x54;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x66, OFFS  // LD H,(IX+54H)
        ]);
        m.cpu.ix = 0x1000;
        m.memory[m.cpu.ix + OFFS] = 0x7C;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, IX");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0x7c)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x67: LD XH,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x67 // LD XH,A
        ]);
        m.cpu.ix = 0xAAAA;
        m.cpu.a = 0x55;


        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xh).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x68: LD XL,B", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0xB9, // LD B,B9H
            0xDD, 0x68  // LD XL,B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX, B");
        m.shouldKeepMemory();

        expect(cpu.xl).toBe(0xb9)
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x69: LD XL,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x69 // LD XL,C
        ]);
        m.cpu.ix = 0xAAAA;
        m.cpu.c = 0x55;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xl).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x6A: LD XL,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x6A // LD XL,D
        ]);
        m.cpu.ix = 0xAAAA;
        m.cpu.d = 0x55;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xl).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x6B: LD XL,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x6B // LD XL,E
        ]);
        m.cpu.ix = 0xAAAA;
        m.cpu.e = 0x55;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xl).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x6C: LD XL,XH", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x6C // LD XL,XH
        ]);
        m.cpu.ix = 0x55AA;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xl).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x6D: LD XL,XL", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x6D // LD XL,XL
        ]);
        m.cpu.ix = 0xAA55;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xl).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x6E: LD L,(IX+d)", ()=> {
        // --- Arrange
        const OFFS = 0x54;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x6E, OFFS  // LD L,(IX+54H)
        ]);
        m.cpu.ix = 0x1000;
        m.memory[m.cpu.ix + OFFS] = 0x7C;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, IX");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0x7c)
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(19);
    });

    it("0x6F: LD XL,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x6F // LD XL,A
        ]);
        m.cpu.ix = 0xAAAA;
        m.cpu.a = 0x55;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX");
        m.shouldKeepMemory();

        expect(cpu.xl).toBe(0x55)
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });
});
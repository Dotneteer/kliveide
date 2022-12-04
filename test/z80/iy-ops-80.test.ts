import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed IY ops 80-8f", () => {
    it("0x80: ADD A,B", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0x06, 0x24, // LD B,24H
            0xFD, 0x80  // ADD A,B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x36);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x81: ADD A,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0x0E, 0x24, // LD C,24H
            0xFD, 0x81  // ADD A,C
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, C");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x36);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x82: ADD A,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0x16, 0x24, // LD D,24H
            0xFD, 0x82  // ADD A,D
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, D");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x36);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x83: ADD A,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0x1E, 0x24, // LD E,24H
            0xFD, 0x83  // ADD A,E
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, E");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x36);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x84: ADD A,YH", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12,             // LD A,12H
            0xFD, 0x21, 0x24, 0x3D, // LD IY,3D24H
            0xFD, 0x84              // ADD A,YH
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, IY");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x4f);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0008);
        expect(cpu.tacts).toBe(29);
    });

    it("0x85: ADD A,YL", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12,             // LD A,12H
            0xFD, 0x21, 0x24, 0x3D, // LD IY,3D24H
            0xFD, 0x85              // ADD A,YL
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, IY");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x36);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0008);
        expect(cpu.tacts).toBe(29);
    });

    it("0x86: ADD A,(IY+d)", ()=> {
        // --- Arrange
        const OFFS = 0x54;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12,      // LD A,12H
            0xFD, 0x86, 0x54 // ADD A,(IY+54H)
        ]);
        m.cpu.iy = 0x1000;
        m.memory[m.cpu.iy + OFFS] = 0x24;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, IY");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x36);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(26);
    });

    it("0x87: ADD A,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0xFD, 0x87  // ADD A,A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x24);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x88: ADC A,B", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0x06, 0x24, // LD B,24H
            0xFD, 0x88  // ADC A,B
        ]);
        m.cpu.f &= 0xfe;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x36);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x89: ADC A,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0x0E, 0x24, // LD C,24H
            0x37,       // SCF
            0xFD, 0x89  // ADC A,C
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, C");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x37);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(26);
    });

    it("0x8A: ADC A,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0x16, 0x24, // LD D,24H
            0x37,       // SCF
            0xFD, 0x8A  // ADC A,D
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, D");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x37);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(26);
    });

    it("0x8B: ADC A,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0x1E, 0x24, // LD E,24H
            0x37,       // SCF
            0xFD, 0x8B  // ADC A,E
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, E");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x37);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(26);
    });

    it("0x8C: ADC A,YH", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0xF0, // LD A,F0H
            0x37,       // SCF
            0xFD, 0x8C  // ADC A,YH
        ]);
        m.cpu.iy = 0xF0AA;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xe1);
        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });

    it("0x8D: ADC A,YL", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0xF0, // LD A,F0H
            0x37,       // SCF
            0xFD, 0x8D  // ADC A,YL
        ]);
        m.cpu.iy = 0xAAF0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xe1);
        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });

    it("0x8E: ADC A,(IY+d)", ()=> {
        // --- Arrange
        const OFFS = 0x54;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0xF0,       // LD A,F0H
            0x37,             // SCF
            0xFD, 0x8E, 0x54  // ADC A,(IY+54H)
        ]);
        m.cpu.iy = 0x1000;
        m.memory[m.cpu.iy + OFFS] = 0xF0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xe1);
        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(30);
    });

    it("0x8F: ADC A,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0x37,       // SCF
            0xFD, 0x8F  // ADC A,A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x25);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });
});
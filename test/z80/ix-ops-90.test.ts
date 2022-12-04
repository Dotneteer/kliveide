import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops 90-9f", () => {
    it("0x90: SUB A,B #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x06, 0x24, // LD B,24H
            0xDD, 0x90  // SUB B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x12);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x91: SUB A,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x0E, 0x24, // LD C,24H
            0xDD, 0x91  // SUB C
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, C");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x12);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x92: SUB A,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x16, 0x24, // LD D,24H
            0xDD, 0x92  // SUB D
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, D");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x12);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x93: SUB A,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x1E, 0x24, // LD E,24H
            0xDD, 0x93  // SUB E
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, E");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x12);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x94: SUB A,H", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x26, 0x24, // LD H,24H
            0x94        // SUB H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, H");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x12);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0x95: SUB A,L", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x2E, 0x24, // LD L,24H
            0x95        // SUB L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, L");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x12);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0x96: SUB A,(HL)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36,       // LD A,36H
            0x21, 0x00, 0x10, // LD HL,1000H
            0x96              // SUB (HL)
        ]);
        m.memory[0x1000] = 0x24;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, HL");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x12);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(24);
    });

    it("0x97: SUB A,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x97        // SUB A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x00);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x98: SBC A,B #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x06, 0x24, // LD B,24H
            0x37,       // SCF
            0x98        // SBC B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x11);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x98: SBC A,B #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x40, // LD A,40H
            0x06, 0x60, // LD B,60H
            0x37,       // SCF
            0x98        // SBC B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xdf);
        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x98: SBC A,B #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x40, // LD A,40H
            0x06, 0x3F, // LD B,3FH
            0x37,       // SCF
            0x98        // SBC B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x00);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x98: SBC A,B #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x41, // LD A,41H
            0x06, 0x43, // LD B,43H
            0x37,       // SCF
            0x98        // SBC B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xfd);
        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x98: SBC A,B #5", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x61, // LD A,61H
            0x06, 0xB3, // LD B,B3H
            0x37,       // SCF
            0x98        // SBC B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xad);
        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x99: SBC A,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x0E, 0x24, // LD C,24H
            0x37,       // SCF
            0x99        // SBC C
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, C");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x11);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x9A: SBC A,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x16, 0x24, // LD D,24H
            0x37,       // SCF
            0x9A        // SBC D
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, D");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x11);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x9B: SBC A,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x1E, 0x24, // LD E,24H
            0x37,       // SCF
            0x9B        // SBC E
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, E");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x11);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x9C: SBC A,H", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x26, 0x24, // LD H,24H
            0x37,       // SCF
            0x9C        // SBC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, H");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x11);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x9D: SBC A,L", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x2E, 0x24, // LD L,24H
            0x37,       // SCF
            0x9D        // SBC L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, L");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x11);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x9E: SBC A,(HL)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36,       // LD A,36H
            0x21, 0x00, 0x10, // LD HL,1000H
            0x37,             // SCF
            0x9E              // SBC (HL)
        ]);
        m.memory[0x1000] = 0x24;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, HL");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x11);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(28);
    });

    it("0x9F: SBC A,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36, // LD A,36H
            0x37,       // SCF
            0x9F        // SBC A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xff);
        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

});
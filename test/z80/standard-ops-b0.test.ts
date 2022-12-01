import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops b0-bf", () => {
    it("0xB0: OR A,B #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x52, // LD A,52H
            0x06, 0x23, // LD B,23H
            0xB0        // OR B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x73);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0xB0: OR A,B #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x82, // LD A,82H
            0x06, 0x22, // LD B,22H
            0xB0        // OR B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xa2);
        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0xB0: OR A,B #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x00, // LD A,00H
            0x06, 0x00, // LD B,00H
            0xB0        // OR B
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
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0xB0: OR A,B #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x32, // LD A,32H
            0x06, 0x11, // LD B,11H
            0xB0        // OR B
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, B");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x33);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0xB1: OR A,C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x52, // LD A,52H
            0x0E, 0x23, // LD C,23H
            0xB1        // OR C
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, C");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x73);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0xB2: OR A,D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x52, // LD A,52H
            0x16, 0x23, // LD D,23H
            0xB2        // OR D
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, D");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x73);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0xB3: OR A,E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x52, // LD A,52H
            0x1E, 0x23, // LD E,23H
            0xB3        // OR E
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, E");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x73);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0xB4: OR A,H", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x52, // LD A,52H
            0x26, 0x23, // LD H,23H
            0xB4        // OR H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, H");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x73);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0xB5: OR A,L", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x52, // LD A,52H
            0x2E, 0x23, // LD L,23H
            0xB5        // OR L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, L");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x73);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0xB6: OR A,(HL)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x52,       // LD A,52H
            0x21, 0x00, 0x10, // LD HL,1000H
            0xB6              // OR (HUL)
        ]);
        m.memory[0x1000] = 0x23;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, HL");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x73);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(24);
    });

    it("0xB7: OR A,A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x52, // LD A,52H
            0xB7        // OR A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x52);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xB8: CP B #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0x24, // LD B,24H
            0xB8        // CP B
        ]);
        m.cpu.a = 0x36;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, B");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xB8: CP B #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0x60, // LD B,60H
            0xB8        // CP B
        ]);
        m.cpu.a = 0x40;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, B");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xB8: CP B #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0x40, // LD B,40H
            0xB8        // CP B
        ]);
        m.cpu.a = 0x40;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, B");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xB8: CP B #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0x43, // LD B,43H
            0xB8        // CP B
        ]);
        m.cpu.a = 0x41;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, B");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xB8: CP B #5", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0xB3, // LD B,B3H
            0xB8        // CP B
        ]);
        m.cpu.a = 0x61;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, B");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xB9: CP C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x0E, 0x24, // LD C,24H
            0xB9        // CP C
        ]);
        m.cpu.a = 0x36;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, C");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xBA: CP D", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x16, 0x24, // LD D,24H
            0xBA        // CP D
        ]);
        m.cpu.a = 0x36;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, D");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xBB: CP E", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x1E, 0x24, // LD E,24H
            0xBB        // CP E
        ]);
        m.cpu.a = 0x36;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, E");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xBC: CP H", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0x24, // LD H,24H
            0xBC        // CP H
        ]);
        m.cpu.a = 0x36;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, H");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xBD: CP L", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2E, 0x24, // LD L,24H
            0xBD        // CP L
        ]);
        m.cpu.a = 0x36;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, L");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0xBE: CP (HL)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x00, 0x10, // LD HL,1000H
            0xBE              // CP (HUL)
        ]);
        m.cpu.a = 0x36;
        m.memory[0x1000] = 0x24;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, HL");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(17);
    });

    it("0xBF: CP A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xBF        // CP A
        ]);
        m.cpu.a = 0x36;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0001);
        expect(cpu.tacts).toBe(4);
    });

});
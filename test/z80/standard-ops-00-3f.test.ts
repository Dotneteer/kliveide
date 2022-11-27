import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops 00-3f", () => {
    it("0x00: nop", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0x00, // NOP
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

    it("0x01: ld bc,NN", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0x01, 0x26, 0xA9 // LD BC,A926H
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

    it("0x02: ld (bc),a", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x01, 0x26, 0xA9, // LD BC,A926H
            0x3E, 0x94,       // LD A,94H
            0x02              // LD (BC),A
        ]);

        // --- Act
        const valueBefore = m.memory[0xA926];
        m.run();
        const valueAfter = m.memory[0xA926];

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("BC, A");
        m.shouldKeepMemory("A926");

        expect(cpu.bc).toBe(0xA926);
        expect(cpu.a).toBe(0x94);
        expect(valueBefore).toBe(0);
        expect(valueAfter).toBe(0x94);
        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(24);
    });

    it("0x03: inc bc", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x01, 0x26, 0xA9, // LD BC,A926H
            0x03              // INC BC
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("BC");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0xA927);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(16);
    });

    it("0x06: ld b,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0x26 // LD B,26H
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

    it("0x0b: dec bc ", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x01, 0x26, 0xA9, // LD BC,A926H
            0x0B              // DEC BC
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("BC");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0xA925);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(16);
    });

    it("0x0e: ld c,N ", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x0e, 0x26 // LD C,26H
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

    it("0x11: ld de,NN", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0x11, 0x26, 0xA9 // LD DE,A926H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("DE");
        m.shouldKeepMemory();

        expect(cpu.de).toBe(0xa926);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(10);
    });

    it("0x12: ld (de),a", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x11, 0x26, 0xA9, // LD DE,A926H
            0x3E, 0x94,       // LD A,94H
            0x12              // LD (DE),A
        ]);

        // --- Act
        const valueBefore = m.memory[0xA926];
        m.run();
        const valueAfter = m.memory[0xA926];

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("DE, A");
        m.shouldKeepMemory("A926");

        expect(cpu.de).toBe(0xA926);
        expect(cpu.a).toBe(0x94);
        expect(valueBefore).toBe(0);
        expect(valueAfter).toBe(0x94);
        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(24);
    });

    it("0x13: inc de ", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x11, 0x26, 0xA9, // LD DE,A926H
            0x13              // INC DE
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("DE");
        m.shouldKeepMemory();

        expect(cpu.de).toBe(0xA927);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(16);
    });

    it("0x16: ld d,N ", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x16, 0x26 // LD D,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("D");
        m.shouldKeepMemory();

        expect(cpu.d).toBe(0x26);
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(7);
    });

    it("0x1b: dec de ", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x11, 0x26, 0xA9, // LD DE,A926H
            0x1B              // DEC DE
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("DE");
        m.shouldKeepMemory();

        expect(cpu.de).toBe(0xA925);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(16);
    });

    it("0x1e: ld e,N ", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x1e, 0x26 // LD E,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("E");
        m.shouldKeepMemory();

        expect(cpu.e).toBe(0x26);
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(7);
    });

    it("0x21: ld hl,NN", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0x21, 0x26, 0xA9 // LD HL,A926H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0xa926);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(10);
    });

    it("0x23: inc hl", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x26, 0xA9, // LD HL,A926H
            0x23              // INC HL
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0xA927);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(16);
    });

    it("0x26: ld h,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0x26 // LD H,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H");
        m.shouldKeepMemory();

        expect(cpu.h).toBe(0x26);
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(7);
    });

    it("0x2b: dec hl", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x26, 0xA9, // LD HL,A926H
            0x2B              // DEC HL
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0xA925);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(16);
    });

    it("0x2e: ld l,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2e, 0x26 // LD L,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L");
        m.shouldKeepMemory();

        expect(cpu.l).toBe(0x26);
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(7);
    });

    it("0x31: ld sp,NN", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0x31, 0x26, 0xA9 // LD HL,A926H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("SP");
        m.shouldKeepMemory();

        expect(cpu.sp).toBe(0xa926);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(10);
    });

    it("0x33: inc sp", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x31, 0x26, 0xA9, // LD SP,A926H
            0x33              // INC SP
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("SP");
        m.shouldKeepMemory();

        expect(cpu.sp).toBe(0xA927);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(16);
    });

    it("0x3b: dec sp", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x31, 0x26, 0xA9, // LD SP,A926H
            0x3B              // DEC SP
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("SP");
        m.shouldKeepMemory();

        expect(cpu.sp).toBe(0xA925);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(16);
    });
});
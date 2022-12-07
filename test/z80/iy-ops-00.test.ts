import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed ops 00-0f", () => {
    it("0x00: nop", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xFD, 0x00, // NOP
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x01: ld bc,NN", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xFD, 0x01, 0x26, 0xA9 // LD BC,A926H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("BC");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0xa926);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(14);
    });

    it("0x02: ld (bc),a", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x01, 0x26, 0xA9, // LD BC,A926H
            0x3E, 0x94,       // LD A,94H
            0xFD, 0x02        // LD (BC),A
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
        expect(cpu.wh).toBe(0x94);
        expect(valueBefore).toBe(0);
        expect(valueAfter).toBe(0x94);
        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(28);
    });

    it("0x03: inc bc", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x01, 0x26, 0xA9, // LD BC,A926H
            0xFD, 0x03        // INC BC
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("BC");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0xA927);
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(20);
    });

    it("0x04: inc b", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0x43, // LD B,43H
            0xFD, 0x04  // INC B
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
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x05: dec b", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x06, 0x43, // LD B,43H
            0xFD, 0x05  // DEC B
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
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x06: ld b,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x06, 0x26 // LD B,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("B");
        m.shouldKeepMemory();

        expect(cpu.b).toBe(0x26);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x07: rlca", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x71, // LD A,71H
            0xFD, 0x07  // RLCA
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
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x08: ex af,af'", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x34,  // LD A,34H
            0x08,        // EX AF,AF'
            0x3E, 0x56 , // LD A,56H
            0xFD, 0x08   // EX AF,AF'
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, AF'");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0x34);
        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(26);
    });

    it("0x09: add iy,bc", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x21, 0x34, 0x12, // LD IY,1234H
            0x01, 0x02, 0x11,       // LD BC,1102H
            0xFD, 0x09              // ADD IY,BC
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, IY");
        m.shouldKeepMemory();
        m.shouldKeepSFlag();
        m.shouldKeepZFlag();
        m.shouldKeepPVFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);

        expect(cpu.iy).toBe(0x2336);
        expect(cpu.pc).toBe(0x0009);
        expect(cpu.tacts).toBe(39);
    });

    it("0x0a: ld a,(bc) ", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x01, 0x03, 0x00, // LD BC,0003H
            0xFD, 0x0A        // LD A,(BC)
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("BC, A");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xfd);
        expect(cpu.wz).toBe(0x0004);
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(21);
    });

    it("0x0b: dec bc ", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x01, 0x26, 0xA9, // LD BC,A926H
            0xFD, 0x0B        // DEC BC
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("BC");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0xA925);
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(20);
    });

    it("0x0c: inc c", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x0e, 0x43, // LD C,43H
            0xFD, 0x0c  // INC C
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
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x0d: dec c", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x0e, 0x43, // LD C,43H
            0xFD, 0x0d  // DEC C
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
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x0e: ld c,N ", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x0e, 0x26 // LD C,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("C");
        m.shouldKeepMemory();

        expect(cpu.c).toBe(0x26);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x0f: rrca", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x70, // LD A,70H
            0xFD, 0x0F  // RRCA
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
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });
});
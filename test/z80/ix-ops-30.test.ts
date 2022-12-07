import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed IX ops 30-3f", () => {
    it("0x30: jrnc", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x37,             // SCF
            0x3F,             // CCF 
            0xDD, 0x30, 0x02  // JR NC,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(24);
    });

    it("0x31: ld sp,NN", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xDD, 0x31, 0x26, 0xA9 // LD SP,A926H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("SP");
        m.shouldKeepMemory();

        expect(cpu.sp).toBe(0xa926);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(14);
    });

    it("0x32: ld (NN),a", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0xA9,       // LD A,A9H
            0xDD, 0x32, 0x00, 0x10  // LD (1000H),A
        ]);

        // --- Act
        const before = m.memory[0x1000];
        m.run();
        const after = m.memory[0x1000];

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A");
        m.shouldKeepMemory("1000");

        expect(before).toBe(0x00);
        expect(after).toBe(0xA9);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(24);
    });

    it("0x33: inc sp", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x31, 0x26, 0xA9, // LD SP,A926H
            0xDD, 0x33        // INC SP
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("SP");
        m.shouldKeepMemory();

        expect(cpu.sp).toBe(0xA927);
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(20);
    });

    it("0x34: inc (ix+d)", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x34, OFFS        // INC (IX+52)
        ]);
        m.cpu.ix = 0x1000;
        m.memory[m.cpu.ix + OFFS] = 0xA5;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX, F");
        m.shouldKeepMemory("1052");

        expect(m.memory[m.cpu.ix + OFFS]).toBe(0xa6);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(23);
    });

    it("0x35: dec (ix+d)", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x35, OFFS        // DEC (IX+52)
        ]);
        m.cpu.ix = 0x1000;
        m.memory[m.cpu.ix + OFFS] = 0xA5;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IX, F");
        m.shouldKeepMemory("1052");

        expect(m.memory[m.cpu.ix + OFFS]).toBe(0xa4);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(23);
    });

    it("0x36: ld (ix+d),N", ()=> {
        // --- Arrange
        const OFFS = 0x52;
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x36, OFFS, 0xD2  // LD (IX+52H),D2H
        ]);
        m.cpu.ix = 0x1000;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory("1052");
        expect(m.memory[cpu.ix + OFFS]).toBe(0xd2);

        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(19);
    });

    it("0x37: scf", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x37,       // SCF 
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F");
        m.shouldKeepMemory();

        expect(cpu.isCFlagSet()).toBe(true);
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x38: jrnc (no jump)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x37,             // SCF
            0x3F,             // CCF 
            0xdd, 0x38, 0x02  // JR C,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });

    it("0x38: jrc (jump)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x37,             // SCF 
            0xDD, 0x38, 0x02  // JR C,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(20);
    });

    it("0x39: add ix,sp #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDd, 0x21, 0x34, 0x12, // LD IX,1234H
            0x31, 0x02, 0x11,       // LD SP,1102H
            0xDD, 0x39              // ADD IX,SP
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, SP, IX");
        m.shouldKeepMemory();
        m.shouldKeepSFlag();
        m.shouldKeepZFlag();
        m.shouldKeepPVFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);

        expect(cpu.ix).toBe(0x2336);
        expect(cpu.pc).toBe(0x0009);
        expect(cpu.tacts).toBe(39);
    });

    it("0x3a: ld a,(NN)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x3A, 0x00, 0x10 // LD A,(1000H)
        ]);
        m.memory[0x1000] = 0x34;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0x34);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(17);
    });

    it("0x3b: dec sp", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x31, 0x26, 0xA9, // LD SP,A926H
            0xDD, 0x3B        // DEC SP
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("SP");
        m.shouldKeepMemory();

        expect(cpu.sp).toBe(0xA925);
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(20);
    });

    it("0x3c: inc a", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x43, // LD A,43H
            0xDD, 0x3c  // INC A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);
        
        expect(cpu.a).toBe(0x44);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x3d: dec a", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x43, // LD A,43H
            0xDD, 0x3d  // DEC A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.a).toBe(0x42);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });

    it("0x3e: ld a,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0x3e, 0x26 // LD A,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0x26);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x3f: ccf", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x37,       // SCF
            0xDD, 0x3F  // CCF
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F");
        m.shouldKeepMemory();

        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(12);
    });
});
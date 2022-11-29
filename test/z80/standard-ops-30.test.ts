import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops 30-3f", () => {
    it("0x30: jrnc (no jump)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x37,       // SCF 
            0x30, 0x02  // JR NC,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x30: jrnc (jump)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x37,       // SCF
            0x3F,       // CCF 
            0x30, 0x02  // JR NC,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(20);
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

    it("0x32: ld (NN),a", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0xA9,       // LD A,A9H
            0x32, 0x00, 0x10  // LD (1000H),A
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

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(20);
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

    it("0x34: inc (hl)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x00, 0x10, // LD HL,1000H
            0x34              // INC (HL)
        ]);
        m.memory[0x1000] = 0x23;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory("1000");

        expect(m.memory[0x1000]).toBe(0x24);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(21);
    });

    it("0x35: dec (hl)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x00, 0x10, // LD HL,1000H
            0x35              // DEC (HL)
        ]);
        m.memory[0x1000] = 0x23;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory("1000");

        expect(m.memory[0x1000]).toBe(0x22);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(21);
    });

    it("0x36: ld (hl),N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x00, 0x10, // LD HL,1000H
            0x36, 0x56        // LD (HL),56H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory("1000");
        expect(m.memory[0x1000]).toBe(0x56);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(20);
    });

    it("0x37: scf", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x37,       // SCF 
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F");
        m.shouldKeepMemory();

        expect(cpu.isCFlagSet()).toBe(true);
        expect(cpu.pc).toBe(0x0001);
        expect(cpu.tacts).toBe(4);
    });

    it("0x39: add hl,sp #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x34, 0x12, // LD HL,1234H
            0x31, 0x02, 0x11, // LD SP,1102H
            0x39              // ADD HL,SP
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, SP, HL");
        m.shouldKeepMemory();
        m.shouldKeepSFlag();
        m.shouldKeepZFlag();
        m.shouldKeepPVFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);

        expect(cpu.hl).toBe(0x2336);
        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(31);
    });

    it("0x39: add hl,sp #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x34, 0xF2, // LD HL,F234H
            0x31, 0x02, 0x11, // LD SP,1102H
            0x39              // ADD HL,SP
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, SP, HL");
        m.shouldKeepMemory();
        m.shouldKeepSFlag();
        m.shouldKeepZFlag();
        m.shouldKeepPVFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isCFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(false);

        expect(cpu.hl).toBe(0x0336);
        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(31);
    });

    it("0x3a: ld a,(NN)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3A, 0x00, 0x10 // LD A,(1000H)
        ]);
        m.memory[0x1000] = 0x34;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0x34);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(13);
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

    it("0x3c: inc a #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x43, // LD A,43H
            0x3c        // INC A
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
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x3c: inc a #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0xFF, // LD A,FFH
            0x3c        // INC A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.a).toBe(0x00);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x3c: inc a #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x7F, // LD A,7FH
            0x3c        // INC A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.a).toBe(0x80);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x3c: inc a #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x2F, // LD A,2FH
            0x3c        // INC A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.a).toBe(0x30);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x3d: dec a #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x43, // LD A,43H
            0x3d        // DEC A
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
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x3d: dec a #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x01, // LD A,01H
            0x3d        // DEC A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.a).toBe(0x00);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x3d: dec a #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x80, // LD A,80H
            0x3d        // DEC A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.a).toBe(0x7f);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x3d: dec a #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x20, // LD H,20H
            0x3d        // DEC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.a).toBe(0x1f);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x3e: ld a,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3e, 0x26 // LD A,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("A");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0x26);
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(7);
    });

    it("0x3f: ccf", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x37, // SCF
            0x3F  // CCF
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F");
        m.shouldKeepMemory();

        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });
});
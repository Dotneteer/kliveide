import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops 20-2f", () => {
    it("0x20: jrnz (no jump)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x01, // LD A,01H
            0x3D,       // DEC A 
            0x20, 0x02  // JR NZ,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0x20: jrnz (jump)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x02, // LD A,02H
            0x3D,       // DEC A 
            0x20, 0x02  // JR NZ,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(23);
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

    it("0x24: inc h #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0x43, // LD H,43H
            0x24        // INC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);
        
        expect(cpu.h).toBe(0x44);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x24: inc h #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0xFF, // LD H,FFH
            0x24        // INC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.h).toBe(0x00);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x24: inc h #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0x7F, // LD H,7FH
            0x24        // INC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.h).toBe(0x80);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x24: inc h #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0x2F, // LD H,2FH
            0x24        // INC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.h).toBe(0x30);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x25: dec h #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0x43, // LD H,43H
            0x25        // DEC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.h).toBe(0x42);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x25: dec h #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0x01, // LD H,01H
            0x25        // DEC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.h).toBe(0x00);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x25: dec h #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0x80, // LD H,80H
            0x25        // DEC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.h).toBe(0x7f);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x25: dec h #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x26, 0x20, // LD H,20H
            0x25        // DEC H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("H, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.h).toBe(0x1f);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
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

    it("0x28: jrz (no jump)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x02, // LD A,02H
            0x3D,       // DEC A 
            0x28, 0x02  // JR Z,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(18);
    });

    it("0x28: jrz (jump)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x01, // LD A,01H
            0x3D,       // DEC A 
            0x28, 0x02  // JR Z,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(23);
    });

    it("0x29: add hl,hl #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x34, 0x12, // LD HL,1234H
            0x29              // ADD HL,HL
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, HL");
        m.shouldKeepMemory();
        m.shouldKeepSFlag();
        m.shouldKeepZFlag();
        m.shouldKeepPVFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);

        expect(cpu.hl).toBe(0x2468);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(21);
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

    it("0x2c: inc l #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2e, 0x43, // LD L,43H
            0x2c        // INC L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);
        
        expect(cpu.l).toBe(0x44);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x2c: inc l #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2e, 0xFF, // LD L,FFH
            0x2c        // INC L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.l).toBe(0x00);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x2c: inc l #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2e, 0x7F, // LD L,7FH
            0x2c        // INC L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.l).toBe(0x80);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x2c: inc l #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2e, 0x2F, // LD L,2FH
            0x2c        // INC L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.l).toBe(0x30);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x2d: dec l #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2e, 0x43, // LD L,43H
            0x2d        // DEC L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.l).toBe(0x42);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x2d: dec l #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2e, 0x01, // LD L,01H
            0x2d        // DEC L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.l).toBe(0x00);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x2d: dec l #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2e, 0x80, // LD L,80H
            0x2d        // DEC L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.l).toBe(0x7f);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x2d: dec l #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x2e, 0x20, // LD L,20H
            0x2d        // DEC L
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("L, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.l).toBe(0x1f);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
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
});
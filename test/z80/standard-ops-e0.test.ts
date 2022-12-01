import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops e0-ef", () => {
    it("0xE0: RET PO #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x2A,       // LD A,2AH
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0x87,             // ADD A
            0xE0,             // RET PO
            0x3E, 0x24,       // LD A,24H
            0xC9              // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x54);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(43);
    });

    it("0xE0: RET PO #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x88,       // LD A,88H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0x87,             // ADD A
            0xE0,             // RET PO
            0x3E, 0x24,       // LD A,24H
            0xC9              // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x24);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(54);
    });

    it("0xE1: POP HL", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x01, 0x52, 0x23, // LD BC,2352H
            0xC5,             // PUSH BC
            0xE1              // POP HL
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, BC");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.hl).toBe(0x2352);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(31);
    });

    it("0xE2: JP PO,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x2A,       // LD A,2AH
            0x87,             // ADD A
            0xE2, 0x07, 0x00, // JP PO,0007H
            0x76,             // HALT
            0x3E, 0xAA,       // LD A,AAH
            0x76              // HALT
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xaa);

        expect(cpu.pc).toBe(0x0009);
        expect(cpu.tacts).toBe(32);
    });

    it("0xE2: JP PO,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x88,       // LD A,88H
            0x87,             // ADD A
            0xE2, 0x07, 0x00, // JP PO,0007H
            0x76,             // HALT
            0x3E, 0xAA,       // LD A,AAH
            0x76              // HALT
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x10);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

    it("0xE4: CALL PO,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x2A,       // LD A,2AH
            0x87,             // ADD A
            0xE4, 0x07, 0x00, // CALL PO,0007H
            0x76,             // HALT
            0x3E, 0x24,       // LD A,24H
            0xC9              // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x24);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(49);
    });

    it("0xE4: CALL PO,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x88,       // LD A,88H
            0x87,             // ADD A
            0xE4, 0x07, 0x00, // CALL PO,0007H
            0x76,             // HALT
            0x3E, 0x24,       // LD A,24H
            0xC9              // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x10);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

    it("0xE5: PUSH HL", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x52, 0x23, // LD HL,2352H
            0xE5,             // PUSH HL
            0xC1              // POP BC
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, BC");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.bc).toBe(0x2352);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(31);
    });

    it("0xE8: RET PE #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x88,       // LD A,88H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0x87,             // ADD A
            0xE8,             // RET PE
            0x3E, 0x24,       // LD A,24H
            0xC9              // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x10);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(43);
    });

    it("0xE8: RET PE #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x2A,       // LD A,2AH
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0x87,             // ADD A
            0xE8,             // RET PE
            0x3E, 0x24,       // LD A,24H
            0xC9              // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x24);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(54);
    });

    it("0xEA: JP PE,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x88,       // LD A,88H
            0x87,             // ADD A
            0xEA, 0x07, 0x00, // JP PE,0007H
            0x76,             // HALT
            0x3E, 0xAA,       // LD A,AAH
            0x76              // HALT
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xaa);

        expect(cpu.pc).toBe(0x0009);
        expect(cpu.tacts).toBe(32);
    });

    it("0xEA: JP PE,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x2A,       // LD A,2AH
            0x87,             // ADD A
            0xEA, 0x07, 0x00, // JP PE,0007H
            0x76,             // HALT
            0x3E, 0xAA,       // LD A,AAH
            0x76              // HALT
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0x54);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

    it("0xEC: CALL PE,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x88,       // LD A,88H
            0x87,             // ADD A
            0xEC, 0x07, 0x00, // CALL PE,0007H
            0x76,             // HALT
            0x3E, 0x24,       // LD A,24H
            0xC9              // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x24);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(49);
    });

    it("0xEC: CALL PE,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x2A,       // LD A,2AH
            0x87,             // ADD A
            0xEC, 0x07, 0x00, // CALL PE,0007H
            0x76,             // HALT
            0x3E, 0x24,       // LD A,24H
            0xC9              // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x54);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

});
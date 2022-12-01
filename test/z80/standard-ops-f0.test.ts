import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops f0-ff", () => {
    it("0xF0: RET P #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x32,       // LD A,32H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0x87,             // ADD A
            0xF0,             // RET P
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
        expect(cpu.a).toBe(0x64);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(43);
    });

    it("0xF0: RET P #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0xC0,       // LD A,C0H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0x87,             // ADD A
            0xF0,             // RET P
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

    it("0xF1: POP AF", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x01, 0x52, 0x23, // LD BC,2352H
            0xC5,             // PUSH BC
            0xF1              // POP AF
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF, BC");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.af).toBe(0x2352);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(31);
    });

    it("0xF2: JP P,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x32,       // LD A,32H
            0x87,             // ADD A
            0xF2, 0x07, 0x00, // JP P,0007H
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

    it("0xF2: JP P,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0xC0,       // LD A,C0H
            0x87,             // ADD A
            0xF2, 0x07, 0x00, // JP P,0007H
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
        expect(cpu.a).toBe(0x80);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

    it("0xF4: CALL P,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x32,       // LD A,32H
            0x87,             // ADD A
            0xF4, 0x07, 0x00, // CALL P,0007H
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

    it("0xF4: CALL P,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0xC0,       // LD A,C0H
            0x87,             // ADD A
            0xF4, 0x07, 0x00, // CALL P,0007H
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
        expect(cpu.a).toBe(0x80);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

    it("0xF5: PUSH AF", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xF5,             // PUSH AF
            0xC1              // POP BC
        ]);
        m.cpu.sp = 0;
        m.cpu.af = 0x3456;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, BC");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.bc).toBe(0x3456);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(21);
    });

    it("0xF8: RET M #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0xC0,       // LD A,C0H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0x87,             // ADD A
            0xF8,             // RET M
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
        expect(cpu.a).toBe(0x80);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(43);
    });

    it("0xF8: RET M #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x32,       // LD A,32H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0x87,             // ADD A
            0xF8,             // RET M
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

    it("0xFA: JP M,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0xC0,       // LD A,C0H
            0x87,             // ADD A
            0xFA, 0x07, 0x00, // JP M,0007H
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

    it("0xFA: JP M,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x32,       // LD A,32H
            0x87,             // ADD A
            0xFA, 0x07, 0x00, // JP M,0007H
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
        expect(cpu.a).toBe(0x64);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

    it("0xFC: CALL M,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0xC0,       // LD A,C0H
            0x87,             // ADD A
            0xFC, 0x07, 0x00, // CALL M,0007H
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

    it("0xFC: CALL M,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x32,       // LD A,32H
            0x87,             // ADD A
            0xFC, 0x07, 0x00, // CALL M,0007H
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
        expect(cpu.a).toBe(0x64);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

});
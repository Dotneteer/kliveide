import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 standard ops c0-cf", () => {
    it("0xC0: RET NZ #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0xB7,             // OR A
            0xC0,             // RET NZ
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
        expect(cpu.a).toBe(0x16);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(43);
    });

    it("0xC0: RET NZ #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x00,       // LD A,00H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0xB7,             // OR A
            0xC0,             // RET NZ
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

    it("0xC1: POP BC", ()=> {
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

    it("0xC2: JP NZ,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xB7,             // OR A
            0xC2, 0x07, 0x00, // JP NZ,0007H
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

    it("0xC2: JP NZ,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x00,       // LD A,00H
            0xB7,             // OR A
            0xC2, 0x07, 0x00, // JP NZ,0007H
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
        expect(cpu.a).toBe(0x00);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

    it("0xC3: JP nn", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xC3, 0x06, 0x00, // JP 0006H
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

        expect(cpu.pc).toBe(0x0008);
        expect(cpu.tacts).toBe(28);
    });

    it("0xC4: CALL NZ,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xB7,             // OR A
            0xC4, 0x07, 0x00, // CALL NZ,0007H
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

    it("0xC4: CALL NZ,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x00,       // LD A,00H
            0xB7,             // OR A
            0xC4, 0x07, 0x00, // CALL NZ,0007H
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
        expect(cpu.a).toBe(0x00);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

    it("0xC5: PUSH BC", ()=> {
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

    it("0xC8: RET Z #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0xAF,             // XOR A
            0xC8,             // RET Z
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
        expect(cpu.a).toBe(0x00);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(43);
    });

    it("0xC8: RET Z #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0xB7,             // OR A
            0xC8,             // RET Z
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

    it("0xC9: RET", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0xC9              // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(38);
    });

    it("0xCA: JP Z,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xAF,             // XOR A
            0xCA, 0x07, 0x00, // JP Z,0007H
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

    it("0xCA: JP Z,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xB7,             // OR A
            0xCA, 0x07, 0x00, // JP Z,0007H
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
        expect(cpu.a).toBe(0x16);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

    it("0xCC: CALL Z,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xAF,             // XOR A
            0xCC, 0x07, 0x00, // CALL Z,0007H
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

    it("0xCC: CALL Z,nn #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xB7,             // OR A
            0xCC, 0x07, 0x00, // CALL Z,0007H
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
        expect(cpu.a).toBe(0x16);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(25);
    });

});
import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 indexed IX ops d0-df", () => {
    it("0xD0: RET NC", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0xA7,             // AND A
            0xDD, 0xD0,       // RET NC
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
        expect(cpu.tacts).toBe(47);
    });

    it("0xD1: POP DE", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x21, 0x52, 0x23, // LD HL,2352H
            0xE5,             // PUSH HL
            0xDD, 0xD1        // POP DE
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, DE");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.de).toBe(0x2352);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(35);
    });

    it("0xD2: JP NC,nn #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,             // LD A,16H
            0xA7,                   // AND A
            0xDD, 0xD2, 0x08, 0x00, // JP NC,0007H
            0x76,                   // HALT
            0x3E, 0xAA,             // LD A,AAH
            0x76                    // HALT
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xaa);

        expect(cpu.pc).toBe(0x000a);
        expect(cpu.tacts).toBe(36);
    });

    it("0xD3: OUT (n),A", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xDD, 0xD3, 0x28  // OUT (N),A
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(m.ioAccessLog.length).toBe(1);
        expect(m.ioAccessLog[0].address).toBe(0x1628);
        expect(m.ioAccessLog[0].value).toBe(0x16);
        expect(m.ioAccessLog[0].isOutput).toBe(true);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(22);
    });

    it("0xD4: CALL NC,nn", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,             // LD A,16H
            0xA7,                   // AND A
            0xDD, 0xD4, 0x08, 0x00, // CALL NC,0008H
            0x76,                   // HALT
            0x3E, 0x24,             // LD A,24H
            0xC9                    // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x24);

        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(53);
    });

    it("0xD5: PUSH DE", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x11, 0x52, 0x23, // LD DE,2352H
            0xDD, 0xD5,       // PUSH DE
            0xE1              // POP HL
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, DE");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.hl).toBe(0x2352);

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(35);
    });

    it("0xD6: SUB A,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36,       // LD A,36H
            0xDD, 0xD6, 0x24  // SUB 24H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
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

    it("0xD7: RST 10", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0xDD, 0xD7  // RST 10H
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("SP");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x12);
        expect(cpu.sp).toBe(0xfffe);
        expect(m.memory[0xFFFE]).toBe(0x04);
        expect(m.memory[0xFFFF]).toBe(0x00);

        expect(cpu.pc).toBe(0x0010);
        expect(cpu.tacts).toBe(22);
    });

    it("0xD8: RET C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0x37,             // SCF
            0xDD, 0xD8,       // RET C
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
        expect(cpu.tacts).toBe(47);
    });

    it("0xD9: EXX", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xDD, 0xD9 // EXX
        ]);
        m.cpu.bc = 0xABCD;
        m.cpu.bc_ = 0x2345;
        m.cpu.de = 0xBCDE;
        m.cpu.de_ = 0x3456;
        m.cpu.hl = 0xCDEF;
        m.cpu.hl_ = 0x4567;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0x2345);
        expect(cpu.bc_).toBe(0xABCD);
        expect(cpu.de).toBe(0x3456);
        expect(cpu.de_).toBe(0xBCDE);
        expect(cpu.hl).toBe(0x4567);
        expect(cpu.hl_).toBe(0xCDEF);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0xDA: JP C,nn", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,             // LD A,16H
            0x37,                   // SCF
            0xDD, 0xDA, 0x08, 0x00, // JP C,0007H
            0x76,                   // HALT
            0x3E, 0xAA,             // LD A,AAH
            0x76                    // HALT
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xaa);

        expect(cpu.pc).toBe(0x000a);
        expect(cpu.tacts).toBe(36);
    });

    it("0xDB: IN A,(n)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xDD, 0xDB, 0x34  // IN A,(34H)
        ]);
        m.ioInputSequence.push(0xD5);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();
        expect(cpu.a).toBe(0xd5);

        expect(m.ioAccessLog.length).toBe(1);
        expect(m.ioAccessLog[0].address).toBe(0x1634);
        expect(m.ioAccessLog[0].value).toBe(0xd5);
        expect(m.ioAccessLog[0].isOutput).toBe(false);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(22);
    });

    it("0xDC: CALL C,nn", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,             // LD A,16H
            0x37,                   // SCF
            0xDD, 0xDC, 0x08, 0x00, // CALL C,0008H
            0x76,                   // HALT
            0x3E, 0x24,             // LD A,24H
            0xC9                    // RET
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x24);

        expect(cpu.pc).toBe(0x0007);
        expect(cpu.tacts).toBe(53);
    });

    it("0xDE: SBC A,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x36,       // LD A,36H
            0x37,             // SCF
            0xDD, 0xDE, 0x24  // SBC 24H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
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

    it("0xDF: RST 18", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0x3E, 0x12, // LD A,12H
            0xDD, 0xDF  // RST 18H
        ]);
        m.cpu.sp = 0;

        // --- Act
        m.run();
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("SP");
        m.shouldKeepMemory("fffe-ffff");
        expect(cpu.a).toBe(0x12);
        expect(cpu.sp).toBe(0xfffe);
        expect(m.memory[0xFFFE]).toBe(0x04);
        expect(m.memory[0xFFFF]).toBe(0x00);

        expect(cpu.pc).toBe(0x0018);
        expect(cpu.tacts).toBe(22);
    });

});
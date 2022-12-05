import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 extended ops 40-4f", () => {
    it("0x40: IN B,(C)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x40 // IN B,(C)
        ]);
        m.ioInputSequence.push(0xD5);
        m.cpu.bc = 0x1234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("B, F");
        m.shouldKeepMemory();

        expect(cpu.b).toBe(0xD5);
        expect(m.ioAccessLog.length).toBe(1);
        expect(m.ioAccessLog[0].address).toBe(0x1234);
        expect(m.ioAccessLog[0].value).toBe(0xD5);
        expect(m.ioAccessLog[0].isOutput).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(12);
    });

    it("0x41: OUT (C),B", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x41 // OUT (C),B
        ]);
        m.ioInputSequence.push(0xD5);
        m.cpu.bc = 0x1234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory();

        expect(m.ioAccessLog.length).toBe(1);
        expect(m.ioAccessLog[0].address).toBe(0x1234);
        expect(m.ioAccessLog[0].value).toBe(0x12);
        expect(m.ioAccessLog[0].isOutput).toBe(true);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(12);
    });

    it("0x42: SBC HL,BC #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x42        // SBC HL,BC
        ]);
        m.cpu.f &= 0xfe;
        m.cpu.hl = 0x3456;
        m.cpu.bc = 0x1234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0x2222);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(15);
    });

    it("0x42: SBC HL,BC #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x42        // SBC HL,BC
        ]);
        m.cpu.f &= 0xfe;
        m.cpu.hl = 0x1234;
        m.cpu.bc = 0x1234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0x0000);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(15);
    });

    it("0x42: SBC HL,BC #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x42        // SBC HL,BC
        ]);
        m.cpu.f |= 0x01;
        m.cpu.hl = 0x3456;
        m.cpu.bc = 0x1234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0x2221);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(15);
    });

    it("0x43: LD (nn),BC", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x43, 0x00, 0x10 // LD (1000H),BC
        ]);
        m.cpu.bc = 0x1234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory("1000-1001");

        expect(m.memory[0x1000]).toBe(0x34);
        expect(m.memory[0x1001]).toBe(0x12);

        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(20);
    });

    it("0x44: NEG", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x44 // NEG
        ]);
        m.cpu.a = 0x03;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xfd);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x45: RETN #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0xED, 0x45        // RETN
        ]);
        m.cpu.iff1 = false;
        m.cpu.sp = 0x0000;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");

        expect(m.cpu.iff1).toBe(m.cpu.iff2);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(42);
    });

    it("0x45: RETN #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0xED, 0x45        // RETN
        ]);
        m.cpu.iff1 = true;
        m.cpu.sp = 0x0000;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");

        expect(m.cpu.iff1).toBe(m.cpu.iff2);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(42);
    });

    it("0x46: IM 0", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x46 // IM 0
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory();

        expect(m.cpu.interruptMode).toBe(0);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x48: IN C,(C)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x48 // IN C,(C)
        ]);
        m.ioInputSequence.push(0xD5);
        m.cpu.bc = 0x1234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("C, F");
        m.shouldKeepMemory();

        expect(cpu.c).toBe(0xD5);
        expect(m.ioAccessLog.length).toBe(1);
        expect(m.ioAccessLog[0].address).toBe(0x1234);
        expect(m.ioAccessLog[0].value).toBe(0xD5);
        expect(m.ioAccessLog[0].isOutput).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(12);
    });

    it("0x49: OUT (C),C", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x49 // OUT (C),C
        ]);
        m.ioInputSequence.push(0xD5);
        m.cpu.bc = 0x1234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory();

        expect(m.ioAccessLog.length).toBe(1);
        expect(m.ioAccessLog[0].address).toBe(0x1234);
        expect(m.ioAccessLog[0].value).toBe(0x34);
        expect(m.ioAccessLog[0].isOutput).toBe(true);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(12);
    });

    it("0x4A: ADC HL,BC #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x4A        // ADC HL,BC
        ]);
        m.cpu.f |= 0x01;
        m.cpu.hl = 0x1111;
        m.cpu.bc = 0x1234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0x2346);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(15);
    });

    it("0x4A: ADC HL,BC #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x4A        // ADC HL,BC
        ]);
        m.cpu.f |= 0x01;
        m.cpu.hl = 0x1111;
        m.cpu.bc = 0xF234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0x0346);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(15);
    });

    it("0x4A: ADC HL,BC #3", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x4A        // ADC HL,BC
        ]);
        m.cpu.f |= 0x01;
        m.cpu.hl = 0x1111;
        m.cpu.bc = 0x7234;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0x8346);
        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(15);
    });

    it("0x4A: ADC HL,BC #4", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x4A        // ADC HL,BC
        ]);
        m.cpu.f |= 0x01;
        m.cpu.hl = 0x0001;
        m.cpu.bc = 0xfffe;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("HL, F");
        m.shouldKeepMemory();

        expect(cpu.hl).toBe(0x0000);
        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(15);
    });

    it("0x4B: LD BC,(nn)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x4B, 0x00, 0x10 // LD BC,(1000H)
        ]);
        m.memory[0x1000] = 0x34;
        m.memory[0x1001] = 0x12;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("BC");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0x1234);

        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(20);
    });

    it("0x4C: NEG", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x4C // NEG
        ]);
        m.cpu.a = 0x03;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.a).toBe(0xfd);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });

    it("0x4D: RETN", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilHalt);
        m.initCode(
        [
            0x3E, 0x16,       // LD A,16H
            0xCD, 0x06, 0x00, // CALL 0006H
            0x76,             // HALT
            0xED, 0x4D        // RETN
        ]);
        m.cpu.iff1 = false;
        m.cpu.sp = 0x0000;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory("fffe-ffff");

        expect(m.cpu.iff1).toBe(m.cpu.iff2);

        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(42);
    });

    it("0x4E: IM 0", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xED, 0x4E // IM 0
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters();
        m.shouldKeepMemory();

        expect(m.cpu.interruptMode).toBe(0);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(8);
    });
});
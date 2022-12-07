import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 extended ops b0-bf", () => {
    it("0xB0: LDIR", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xB0 // LDIR
        ]);
        m.cpu.f &= 0xfe;
        m.cpu.bc = 0x0003;
        m.cpu.hl = 0x1001;
        m.cpu.de = 0x1000;
        m.memory[m.cpu.hl] = 0xA5;
        m.memory[m.cpu.hl + 1] = 0xA6;
        m.memory[m.cpu.hl + 2] = 0xA7;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, DE, HL");
        m.shouldKeepMemory("1000-1002");

        expect(m.memory[0x1000]).toBe(0xA5);
        expect(m.memory[0x1001]).toBe(0xA6);
        expect(m.memory[0x1002]).toBe(0xA7);
        expect(cpu.bc).toBe(0x0000);
        expect(cpu.hl).toBe(0x1004);
        expect(cpu.de).toBe(0x1003);

        expect(cpu.isSFlagSet()).toBe(true);
        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(58);
    });

    it("0xB1: CPIR #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xB1 // CPIR
        ]);
        m.cpu.f &= 0xfe;
        m.cpu.bc = 0x0003;
        m.cpu.hl = 0x1000;
        m.cpu.a &= 0x11;
        m.memory[m.cpu.hl] = 0xA5;
        m.memory[m.cpu.hl + 1] = 0xA6;
        m.memory[m.cpu.hl + 2] = 0xA7;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, HL");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0x0000);
        expect(cpu.hl).toBe(0x1003);

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isNFlagSet()).toBe(true);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(58);
    });

    it("0xB1: CPIR #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xB1 // CPIR
        ]);
        m.cpu.f &= 0xfe;
        m.cpu.bc = 0x0003;
        m.cpu.hl = 0x1000;
        m.cpu.a &= 0xA6;
        m.memory[m.cpu.hl] = 0xA5;
        m.memory[m.cpu.hl + 1] = 0xA6;
        m.memory[m.cpu.hl + 2] = 0xA7;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, HL");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0x0001);
        expect(cpu.hl).toBe(0x1002);

        expect(cpu.isSFlagSet()).toBe(false);
        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(true);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(37);
    });

    it("0xB2: INIR", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xB2 // INIR
        ]);
        m.cpu.bc = 0x03CC;
        m.cpu.hl = 0x1000;
        m.ioInputSequence.push(0x69);
        m.ioInputSequence.push(0x6A);
        m.ioInputSequence.push(0x6B);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, HL");
        m.shouldKeepMemory("1000-1002");

        expect(m.memory[0x1000]).toBe(0x69);
        expect(m.memory[0x1001]).toBe(0x6A);
        expect(m.memory[0x1002]).toBe(0x6B);
        expect(cpu.b).toBe(0x00);
        expect(cpu.c).toBe(0xcc);
        expect(cpu.hl).toBe(0x1003);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(58);
    });

    it("0xB3: OTIR", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xB3 // OTIR
        ]);
        m.cpu.bc = 0x03CC;
        m.cpu.hl = 0x1000;
        m.memory[m.cpu.hl] = 0x29;
        m.memory[m.cpu.hl + 1] = 0x2A;
        m.memory[m.cpu.hl + 2] = 0x2B;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, HL");
        m.shouldKeepMemory();

        expect(cpu.b).toBe(0x00);
        expect(cpu.c).toBe(0xcc);
        expect(cpu.hl).toBe(0x1003);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(m.ioAccessLog.length).toBe(3);
        expect(m.ioAccessLog[0].address).toBe(0x02CC);
        expect(m.ioAccessLog[0].value).toBe(0x29);
        expect(m.ioAccessLog[0].isOutput).toBe(true);
        expect(m.ioAccessLog[1].address).toBe(0x01CC);
        expect(m.ioAccessLog[1].value).toBe(0x2A);
        expect(m.ioAccessLog[1].isOutput).toBe(true);
        expect(m.ioAccessLog[2].address).toBe(0x00CC);
        expect(m.ioAccessLog[2].value).toBe(0x2B);
        expect(m.ioAccessLog[2].isOutput).toBe(true);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(58);
    });

    it("0xB8: LDDR", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xB8 // LDDR
        ]);
        m.cpu.f &= 0xfe;
        m.cpu.bc = 0x0003;
        m.cpu.hl = 0x1002;
        m.cpu.de = 0x1003;
        m.memory[m.cpu.hl - 2] = 0xA5;
        m.memory[m.cpu.hl - 1] = 0xA6;
        m.memory[m.cpu.hl] = 0xA7;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, DE, HL");
        m.shouldKeepMemory("1001-1003");

        expect(m.memory[0x1001]).toBe(0xA5);
        expect(m.memory[0x1002]).toBe(0xA6);
        expect(m.memory[0x1003]).toBe(0xA7);
        expect(cpu.bc).toBe(0x0000);
        expect(cpu.hl).toBe(0x0fff);
        expect(cpu.de).toBe(0x1000);

        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(58);
    });

    it("0xB9: CPDR #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xB9 // CPDR
        ]);
        m.cpu.f &= 0xfe;
        m.cpu.bc = 0x0003;
        m.cpu.hl = 0x1002;
        m.cpu.a &= 0x11;
        m.memory[m.cpu.hl - 2] = 0xA5;
        m.memory[m.cpu.hl - 1] = 0xA6;
        m.memory[m.cpu.hl] = 0xA7;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, HL");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0x0000);
        expect(cpu.hl).toBe(0x0fff);

        expect(cpu.isZFlagSet()).toBe(false);
        expect(cpu.isPvFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isNFlagSet()).toBe(true);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(58);
    });

    it("0xB9: CPDR #2", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xB9 // CPDR
        ]);
        m.cpu.f &= 0xfe;
        m.cpu.bc = 0x0003;
        m.cpu.hl = 0x1002;
        m.cpu.a &= 0xA6;
        m.memory[m.cpu.hl - 2] = 0xA5;
        m.memory[m.cpu.hl - 1] = 0xA6;
        m.memory[m.cpu.hl] = 0xA7;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, HL");
        m.shouldKeepMemory();

        expect(cpu.bc).toBe(0x0001);
        expect(cpu.hl).toBe(0x1000);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isPvFlagSet()).toBe(true);
        expect(cpu.isHFlagSet()).toBe(false);
        expect(cpu.isNFlagSet()).toBe(true);
        expect(cpu.isCFlagSet()).toBe(false);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(37);
    });

    it("0xBA: INDR", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xBA // INDR
        ]);
        m.cpu.bc = 0x03CC;
        m.cpu.hl = 0x1002;
        m.ioInputSequence.push(0x69);
        m.ioInputSequence.push(0x6A);
        m.ioInputSequence.push(0x6B);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, HL");
        m.shouldKeepMemory("1000-1002");

        expect(m.memory[0x1000]).toBe(0x6B);
        expect(m.memory[0x1001]).toBe(0x6A);
        expect(m.memory[0x1002]).toBe(0x69);
        expect(cpu.b).toBe(0x00);
        expect(cpu.c).toBe(0xcc);
        expect(cpu.hl).toBe(0x0fff);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(58);
    });

    it("0xBB: OTDR", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xED, 0xBB // OTDR
        ]);
        m.cpu.bc = 0x03CC;
        m.cpu.hl = 0x1002;
        m.memory[m.cpu.hl - 2] = 0x29;
        m.memory[m.cpu.hl - 1] = 0x2A;
        m.memory[m.cpu.hl] = 0x2B;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, BC, HL");
        m.shouldKeepMemory();

        expect(cpu.b).toBe(0x00);
        expect(cpu.c).toBe(0xcc);
        expect(cpu.hl).toBe(0x0fff);

        expect(cpu.isZFlagSet()).toBe(true);
        expect(cpu.isNFlagSet()).toBe(false);
        expect(cpu.isCFlagSet()).toBe(true);

        expect(m.ioAccessLog.length).toBe(3);
        expect(m.ioAccessLog[0].address).toBe(0x02CC);
        expect(m.ioAccessLog[0].value).toBe(0x2B);
        expect(m.ioAccessLog[0].isOutput).toBe(true);
        expect(m.ioAccessLog[1].address).toBe(0x01CC);
        expect(m.ioAccessLog[1].value).toBe(0x2A);
        expect(m.ioAccessLog[1].isOutput).toBe(true);
        expect(m.ioAccessLog[2].address).toBe(0x00CC);
        expect(m.ioAccessLog[2].value).toBe(0x29);
        expect(m.ioAccessLog[2].isOutput).toBe(true);

        expect(cpu.pc).toBe(0x0002);
        expect(cpu.tacts).toBe(58);
    });
});
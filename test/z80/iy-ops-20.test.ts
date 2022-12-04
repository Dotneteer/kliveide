import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";
import { FlagsSetMask } from "@/emu/abstractions/IZ80Cpu";

class DaaSample {
    constructor(
        public readonly a: number,
        public readonly h: boolean,
        public readonly n: boolean,
        public readonly c: boolean,
        public readonly af: number
    ) {}
}

describe("Z80 IY indexed ops 20-2f", () => {
    it("0x20: jrnz", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x01,       // LD A,01H
            0x3D,             // DEC A 
            0xFD, 0x20, 0x02  // JR NZ,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(22);
    });

    it("0x21: ld IY,NN", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.OneInstruction);
        m.initCode(
        [
            0xFD, 0x21, 0x26, 0xA9 // LD HL,A926H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY");
        m.shouldKeepMemory();

        expect(cpu.iy).toBe(0xa926);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(14);
    });

    it("0x22: ld (NN),iy", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x21, 0x26, 0xA9, // LD IY,A926H
            0xFD, 0x22, 0x00, 0x10  // LD (1000H),IY
        ]);

        // --- Act
        const lBefore = m.memory[0x1000];
        const hBefore = m.memory[0x1001];
        m.run();
        const lAfter = m.memory[0x1000];
        const hAfter = m.memory[0x1001];

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY");
        m.shouldKeepMemory("1000-1001");

        expect(cpu.iy).toBe(0xA926);
        expect(lBefore).toBe(0x00);
        expect(hBefore).toBe(0x00);
        expect(lAfter).toBe(0x26);
        expect(hAfter).toBe(0xA9);
        expect(cpu.pc).toBe(0x0008);
        expect(cpu.tacts).toBe(34);
    });

    it("0x23: inc iy", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x21, 0x26, 0xA9, // LD IY,A926H
            0xFD, 0x23              // INC IY
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY");
        m.shouldKeepMemory();

        expect(cpu.iy).toBe(0xA927);
        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(24);
    });

    it("0x24: inc yh", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x26, 0x43, // LD YH,43H
            0xFD, 0x24        // INC YH
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);
        
        expect(cpu.yh).toBe(0x44);
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });

    it("0x25: dec yh", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x26, 0x43, // LD YH,43H
            0xFD, 0x25        // DEC YH
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.yh).toBe(0x42);
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });

    it("0x26: ld yh,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x26, 0x26 // LD YH,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY");
        m.shouldKeepMemory();

        expect(cpu.yh).toBe(0x26);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    const daaSamples = [
        new DaaSample(0x99, false, false, false, 0x998C),
        new DaaSample(0x99, true, false, false, 0x9F8C),
        new DaaSample(0x7A, false, false, false, 0x8090),
        new DaaSample(0x7A, true, false, false, 0x8090),
        new DaaSample(0xA9, false, false, false, 0x090D),
        new DaaSample(0x87, false, false, true, 0xE7A5),
        new DaaSample(0x87, true, false, true, 0xEDAD),
        new DaaSample(0x1B, false, false, true, 0x8195),
        new DaaSample(0x1B, true, false, true, 0x8195),
        new DaaSample(0xAA, false, false, false, 0x1011),
        new DaaSample(0xAA, true, false, false, 0x1011),
        new DaaSample(0xC6, true, false, false, 0x2C29)
    ];

    daaSamples.forEach((sample, index) => 
        it(`0x27: daa #${index}`, () => {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.UntilEnd);
            m.initCode(
            [
                0xFD, 0x27  // DAA
            ]);
            m.cpu.a = sample.a;
            m.cpu.f = (sample.h ? FlagsSetMask.H : 0)
                | (sample.n ? FlagsSetMask.N : 0)
                | (sample.c ? FlagsSetMask.C : 0);

            // --- Act
            m.run();

            // --- Assert
            const cpu = m.cpu;
            m.shouldKeepRegisters("AF");
            m.shouldKeepMemory();

            expect(cpu.af).toBe(sample.af);
            expect(cpu.pc).toBe(0x0002);
            expect(cpu.tacts).toBe(8);
        })
    );

    it("0x28: jrz (jump)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x01,       // LD A,01H
            0x3D,             // DEC A 
            0xFD, 0x28, 0x02  // JR Z,02H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("AF");
        m.shouldKeepMemory();

        expect(cpu.pc).toBe(0x0008);
        expect(cpu.tacts).toBe(27);
    });

    it("0x29: add iy,iy #1", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x21, 0x34, 0x12, // LD IY,1234H
            0xFD, 0x29              // ADD IY,IY
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("F, IY");
        m.shouldKeepMemory();
        m.shouldKeepSFlag();
        m.shouldKeepZFlag();
        m.shouldKeepPVFlag();
        expect(cpu.isNFlagSet()).toBe(false);

        expect(cpu.isCFlagSet()).toBe(false);
        expect(cpu.isHFlagSet()).toBe(false);

        expect(cpu.iy).toBe(0x2468);
        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(29);
    });

    it("0x2a: ld iy,(NN)", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x2A, 0x00, 0x10 // LD HL,(1000H)
        ]);
        m.memory[0x1000] = 0x34;
        m.memory[0x1001] = 0x12;

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY");
        m.shouldKeepMemory();

        expect(cpu.iy).toBe(0x1234);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(20);
    });

    it("0x2b: dec iy", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x21, 0x26, 0xA9, // LD IY,A926H
            0xFD, 0x2B              // DEC IY
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY");
        m.shouldKeepMemory();

        expect(cpu.iy).toBe(0xA925);
        expect(cpu.pc).toBe(0x0006);
        expect(cpu.tacts).toBe(24);
    });

    it("0x2c: inc yl", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x2e, 0x43, // LD YL,43H
            0xFD, 0x2c        // INC YL
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(false);
        
        expect(cpu.yl).toBe(0x44);
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });

    it("0x2d: dec yl", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x2e, 0x43, // LD YL,43H
            0xFD, 0x2d        // DEC YL
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY, F");
        m.shouldKeepMemory();
        m.shouldKeepCFlag();
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.yl).toBe(0x42);
        expect(cpu.pc).toBe(0x0005);
        expect(cpu.tacts).toBe(19);
    });

    it("0x2e: ld yl,N", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0xFD, 0x2e, 0x26 // LD YL,26H
        ]);

        // --- Act
        m.run();

        // --- Assert
        const cpu = m.cpu;
        m.shouldKeepRegisters("IY");
        m.shouldKeepMemory();

        expect(cpu.yl).toBe(0x26);
        expect(cpu.pc).toBe(0x0003);
        expect(cpu.tacts).toBe(11);
    });

    it("0x2f: cpl", ()=> {
        // --- Arrange
        const m = new Z80TestMachine(RunMode.UntilEnd);
        m.initCode(
        [
            0x3E, 0x81, // LD A,81H
            0xFD, 0x2F  // CPL
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
        m.shouldKeepCFlag();
        expect(cpu.isHFlagSet()).toBe(true);
        expect(cpu.isNFlagSet()).toBe(true);

        expect(cpu.a).toBe(0x7e);
        expect(cpu.pc).toBe(0x0004);
        expect(cpu.tacts).toBe(15);
    });
});

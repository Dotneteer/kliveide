import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 IY BIT ops 40-ff", () => {
    it("BIT N,(IY+d)", ()=> {
        // --- Arrange
        const OFFS = 0x54;
        for (let n = 0; n < 8; n++) {
            for (var repeat = 0; repeat < 8; repeat++) {
                // --- Arrange
                const m = new Z80TestMachine(RunMode.OneInstruction);
                const opcn = 0x40 | (n << 3) | repeat;

                m.initCode([
                    0xFD, 0xCB, OFFS, opcn // BIT N,(IY+54H)
                ]);

                m.cpu.f &= 0xfe;
                m.cpu.iy = 0x1000;
                m.memory[m.cpu.iy + OFFS] = ~(0x01 << n);

                // --- Act
                m.run();

                // --- Assert
                m.shouldKeepRegisters("F");
                m.shouldKeepMemory();

                expect(m.cpu.isSFlagSet()).toBe(false);
                expect(m.cpu.isZFlagSet()).toBe(true);
                expect(m.cpu.isCFlagSet()).toBe(false);
                expect(m.cpu.isPvFlagSet()).toBe(true);
                expect(m.cpu.isHFlagSet()).toBe(true);
                expect(m.cpu.isNFlagSet()).toBe(false);

                expect(m.cpu.pc).toBe(0x0004);
                expect(m.cpu.tacts).toBe(20);
            }
        }
    });

    it("RES N,(IY+d)", ()=> {
        // --- Arrange
        const OFFS = 0x54;
        for (let n = 0; n < 8; n++) {
            for (var repeat = 0; repeat < 8; repeat++) {
                // --- Arrange
                const m = new Z80TestMachine(RunMode.OneInstruction);
                const opcn = 0x80 | (n << 3) | repeat;

                m.initCode([
                    0xFD, 0xCB, OFFS, opcn // RES N,(IY+54H)
                ]);

                m.cpu.f &= 0xfe;
                m.cpu.iy = 0x1000;
                m.memory[m.cpu.iy + OFFS] = 0xff;

                // --- Act
                m.run();

                // --- Assert
                m.shouldKeepMemory("1054");

                expect(m.memory[m.cpu.iy + OFFS]).toBe(0xFF & ~(1 << n));

                expect(m.cpu.pc).toBe(0x0004);
                expect(m.cpu.tacts).toBe(23);
            }
        }
    });
    
    it("SET N,(IY+d)", ()=> {
        // --- Arrange
        const OFFS = 0x54;
        for (let n = 0; n < 8; n++) {
            for (var repeat = 0; repeat < 8; repeat++) {
                // --- Arrange
                const m = new Z80TestMachine(RunMode.OneInstruction);
                const opcn = 0xC0 | (n << 3) | repeat;

                m.initCode([
                    0xFD, 0xCB, OFFS, opcn // RES N,(IY+54H)
                ]);

                m.cpu.f &= 0xfe;
                m.cpu.iy = 0x1000;
                m.memory[m.cpu.iy + OFFS] = 0x00;

                // --- Act
                m.run();

                // --- Assert
                m.shouldKeepMemory("1054");

                expect(m.memory[m.cpu.iy + OFFS]).toBe(1 << n);

                expect(m.cpu.pc).toBe(0x0004);
                expect(m.cpu.tacts).toBe(23);
            }
        }
    });
});
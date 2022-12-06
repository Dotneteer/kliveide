import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 extended ops b0-bf", () => {
    it("0xB0: LDI", ()=> {
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

});
import "mocha";
import { expect } from "expect";
import { RunMode, Z80TestMachine } from "./test-z80";

describe("Z80 set ops c0-ff", () => {
    it("SET n,B #1", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc0 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,B
            ]);

            m.cpu.b = 0x00;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("B");
            m.shouldKeepMemory();

            expect(m.cpu.b).toBe(1 << n);

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,B #2", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc0 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,B
            ]);

            m.cpu.b = 0x55;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("B");
            m.shouldKeepMemory();

            expect(m.cpu.b).toBe(0x55 | (1 << n));

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,C #1", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc1 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,C
            ]);

            m.cpu.c = 0x00;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("C");
            m.shouldKeepMemory();

            expect(m.cpu.c).toBe(1 << n);

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,C #2", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc1 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,C
            ]);

            m.cpu.c = 0x55;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("C");
            m.shouldKeepMemory();

            expect(m.cpu.c).toBe(0x55 | (1 << n));

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,D #1", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc2 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,D
            ]);

            m.cpu.d = 0x00;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("D");
            m.shouldKeepMemory();

            expect(m.cpu.d).toBe(1 << n);

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,D #2", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc2 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,D
            ]);

            m.cpu.d = 0x55;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("D");
            m.shouldKeepMemory();

            expect(m.cpu.d).toBe(0x55 | (1 << n));

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,E #1", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc3 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,E
            ]);

            m.cpu.e = 0x00;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("E");
            m.shouldKeepMemory();

            expect(m.cpu.e).toBe(1 << n);

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,E #2", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc3 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,E
            ]);

            m.cpu.e = 0x55;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("E");
            m.shouldKeepMemory();

            expect(m.cpu.e).toBe(0x55 | (1 << n));

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,H #1", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc4 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,H
            ]);

            m.cpu.h = 0x00;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("H");
            m.shouldKeepMemory();

            expect(m.cpu.h).toBe(1 << n);

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,H #2", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc4 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,H
            ]);

            m.cpu.h = 0x55;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("H");
            m.shouldKeepMemory();

            expect(m.cpu.h).toBe(0x55 | (1 << n));

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,L #1", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc5 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,L
            ]);

            m.cpu.b = 0x00;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("L");
            m.shouldKeepMemory();

            expect(m.cpu.l).toBe(1 << n);

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,L #2", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc5 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,L
            ]);

            m.cpu.l = 0x55;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("L");
            m.shouldKeepMemory();

            expect(m.cpu.l).toBe(0x55 | (1 << n));

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,(HL) #1", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc6 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,B
            ]);
            m.cpu.hl = 0x1000;
            m.memory[m.cpu.hl] = 0x00;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters();
            m.shouldKeepMemory("1000");

            expect(m.memory[m.cpu.hl]).toBe(1 << n);

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(15);
        }
    });

    it("SET n,(HL) #2", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc6 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,B
            ]);
            m.cpu.hl = 0x1000;
            m.memory[m.cpu.hl] = 0x55;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters();
            m.shouldKeepMemory("1000");

            expect(m.memory[m.cpu.hl]).toBe(0x55 | (1 << n));

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(15);
        }
    });

    it("SET n,A #1", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc7 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,A
            ]);

            m.cpu.a = 0x00;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("A");
            m.shouldKeepMemory();

            expect(m.cpu.a).toBe(1 << n);

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });

    it("SET n,A #2", ()=> {
        for (let n = 0; n < 8; n++) {
            // --- Arrange
            const m = new Z80TestMachine(RunMode.OneInstruction);
            const opcn = 0xc7 | (n << 3);

            m.initCode([
                0xCB, opcn // SET N,A
            ]);

            m.cpu.a = 0x55;

            // --- Act
            m.run();

            // --- Assert
            m.shouldKeepRegisters("A");
            m.shouldKeepMemory();

            expect(m.cpu.a).toBe(0x55 | (1 << n));

            expect(m.cpu.pc).toBe(0x0002);
            expect(m.cpu.tacts).toBe(8);
        }
    });
});
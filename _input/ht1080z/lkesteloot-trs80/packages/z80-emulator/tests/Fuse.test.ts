// Runs the FUSE Z80 tests (from z80-test) against our emulator, one Vitest test per case.

import {describe, expect, it} from "vitest";
import {hi, Register, toHex} from "z80-base";
import {CpuEvent, CpuEventType, Delegate, Runner} from "z80-test";
import {Hal} from "../src/Hal.js";
import {Z80} from "../src/Z80.js";

/**
 * HAL for the test suite.
 */
class HalImpl implements Hal {
    public memory: Uint8Array = new Uint8Array(64*1024);
    public events: CpuEvent[] = [];
    public tStateCount = 0;

    public reset(): void {
        this.memory.fill(0);
        this.events = [];
        this.tStateCount = 0;
    }

    public contendMemory(address: number): void {
        this.events.push(new CpuEvent(this.tStateCount, CpuEventType.MEMORY_CONTEND, address));
    }

    public contendPort(address: number): void {
        this.events.push(new CpuEvent(this.tStateCount, CpuEventType.PORT_CONTEND, address));
    }

    public readMemory(address: number): number {
        const value = this.memory[address];
        this.events.push(new CpuEvent(this.tStateCount, CpuEventType.MEMORY_READ, address, value));
        return value;
    }

    public readPort(address: number): number {
        const value = hi(address); // For testing.
        this.events.push(new CpuEvent(this.tStateCount, CpuEventType.PORT_READ, address, value));
        return value;
    }

    public writeMemory(address: number, value: number): void {
        this.events.push(new CpuEvent(this.tStateCount, CpuEventType.MEMORY_WRITE, address, value));
        this.memory[address] = value;
    }

    public writePort(address: number, value: number): void {
        this.events.push(new CpuEvent(this.tStateCount, CpuEventType.PORT_WRITE, address, value));
    }
}

/**
 * Delegate for the test suite.
 */
class DelegateImpl implements Delegate {
    private hal: HalImpl = new HalImpl();
    private z80: Z80 = new Z80(this.hal);

    public startNewTest(name: string): void {
        // console.log("Running test \"" + name + "\"");
        this.z80.reset();
        this.hal.reset();
    }

    public getRegister(register: Register): number {
        const value = this.z80.regs[register];
        // console.log("Checking value of " + Register[register] + " (" + toHex(value, 4) + ")");
        return value;
    }

    public readMemory(address: number): number {
        const value = this.hal.memory[address];
        // console.log("Checking value of " + toHex(address, 4) + " (" + toHex(value, 2) + ")");
        return value;
    }

    public run(tStateCount: number): CpuEvent[] {
        // console.log("Running for " + tStateCount + " t-states");
        while (this.hal.tStateCount < tStateCount) {
            this.z80.step();
        }
        return this.hal.events;
    }

    public setRegister(register: Register, value: number): void {
        // console.log("Setting register " + Register[register] + " to " + toHex(value, 4));
        this.z80.regs[register] = value;
    }

    public writeMemory(address: number, value: number): void {
        // console.log("Writing " + toHex(value, 2) + " to " + toHex(address, 4));
        this.hal.memory[address] = value;
    }

    public getTStateCount(): number {
        return this.hal.tStateCount;
    }
}

const runner = new Runner(new DelegateImpl());
runner.checkEvents = false;
runner.checkTStates = true;
runner.checkContend = false;
runner.loadTests();

describe("FUSE Z80 tests", () => {
    it("loaded the tests", () => {
        expect(runner.tests.size).to.be.greaterThan(0);
    });

    // Run a single one with "vitest run -t ed7a".
    for (const test of runner.tests.values()) {
        it(test.name, () => {
            expect(runner.runTest(test)).to.eql([]);
        });
    }
});

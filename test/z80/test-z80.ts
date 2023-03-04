import { FlagsSetMask } from "../../src/emu/abstractions/FlagSetMask";
import { IZ80Cpu } from "../../src/emu/abstractions/IZ80Cpu";
import { OpCodePrefix } from "../../src/emu/abstractions/OpCodePrefix";
import { ILiteEvent, LiteEvent } from "../../src/emu/utils/lite-event";
import { Z80Cpu } from "../../src/emu/z80/Z80Cpu";

/**
 * This enum defines the run modes the Z80TestMachine allows
 */
export enum RunMode
{
    /**
     * Run while the machine is disposed or a break signal arrives.
     */
    Normal,

    /**
     * Run a single CPU Execution cycle, even if an operation contains multiple bytes
     */
    OneCycle,

    /**
     * Pause when the next single instruction is executed.
     */
    OneInstruction,

    /**
     * Run until a HALT instruction is reached.
     */
    UntilHalt,

    /**
     * Run until the whole injected code is executed.
     */
    UntilEnd
}

/**
 * Implements a Z80 CPU used for testing
 */
export class Z80TestCpu extends Z80Cpu
{
    constructor(private readonly machine: Z80TestMachine)
    {
        super();
    }

    doReadMemory(address: number): number {
        return this.machine.readMemory(address);
    }

    doWriteMemory(address: number, value: number) {
        this.machine.writeMemory(address, value);
    }

    doReadPort(address: number): number {
        return this.machine.readPort(address);
    }

    doWritePort(address: number, value: number) {
        this.machine.writePort(address, value);
    }
}

/**
 * This class implements a Z80 machine that can be used for unit testing.
 * 
 * The methods of the class allow injecting and running Z80 code. Helper methods make it easy to test expected
 * behavior.
 */
export class Z80TestMachine
{
    private readonly _stepOutStack: number[] = [];
    private _callExecuted: boolean;
    private _retExecuted: boolean;
    private _cpuCycleCompleted = new LiteEvent<void>();

    /**
     * The Z80 CPU of the test machine
     */
    readonly cpu: Z80Cpu;

    /**
     * The operative memory of the test machine
     */
    readonly memory: number[];

    /**
     * The address where the code execution ends.
     */
    codeEndsAt: number;

    /**
     * A log that helps testing memory access operations.
     */
    memoryAccessLog: MemoryOp[];

    /**
     * A log that helps testing I/O access operations.
     */
    ioAccessLog: IoOp[];

    /**
     * 
     */
    ioInputSequence: number[];

    /**
     * The count of I/O reads
     */
    ioReadCount: number;

    /**
     * Sign that a CPU cycle has just been completed.
     */
    get cpuCycleCompleted(): ILiteEvent<void> {
        return this._cpuCycleCompleted;
    }

    /**
     * Store the values of the Z80 registers before a test case runs.
     */
    registersBeforeRun? : Z80RegisterSnapshot;

    /**
     * Store the state of the memory before a test case runs.
     */
    memoryBeforeRun: number[] = [];

    /**
     * Gets the last popped Step-Out address
     */
    stepOutAddress?: number;

    /**
     * Helper information to test the step-out functionality (CALL instructions)
     */
    callStepOutEvents: number[] = [];

    /**
     * Helper information to test the step-out functionality (RET instructions)
     */
    retStepOutEvents: number[] = [];

    /**
     * Helper information to test the step-out functionality (PUSH instructions)
     */
    stepOutPushEvents: number[] = [];

    /**
     * Helper information to test the step-out functionality (POP instructions)
     */
    stepOutPopEvents: number[] = [];

    /**
     * Initialize the test machine.
     * @param runMode Specify the mode in which the test machine runs.
     * @param allowExtendedInstructions Sign if ZX Spectrum Next extended instructions can run.
     */
    constructor(
        public readonly runMode: RunMode = RunMode.Normal, 
        public readonly allowExtendedInstructions = false) {
        this.cpu = new Z80TestCpu(this);
        this.memory = [];
        for (let i = 0; i < 0x1_0000; i++) this.memory[i] = 0x00;
        this.memoryAccessLog = [];
        this.ioAccessLog = [];
        this.ioInputSequence = [];
        this.ioReadCount = 0;
        this.cpu = new Z80TestCpu(this);
        this.cpu.allowExtendedInstructions = allowExtendedInstructions;
    }

    /**
     * Initializes the code passed in `programCode`. This code is put into the memory from `codeAddress` and code
     * execution starts at `startAddress`
     * @param programCode Bytes of the program
     * @param codeAddress Injection start address
     * @param startAddress Execution start address
     */
    initCode(
        programCode?: number[], 
        codeAddress = 0,
        startAddress = 0): void
    {
        // --- Initialize the code
        if (programCode != null)
        {
            for (const op of programCode) {
                this.memory[codeAddress++] = op;
            }
            this.codeEndsAt = codeAddress;
            while (codeAddress < 0xffff) {
                this.memory[codeAddress++] = 0;
            }
        }

        // --- Init code execution
        this.cpu.reset();
        this.cpu.pc = startAddress;
    }

    /**
     * Run the injected code.
     */
    run(): void
    {
        this.registersBeforeRun = new Z80RegisterSnapshot(this.cpu);
        this.memoryBeforeRun = [];
        for (let i = 0; i < this.memory.length; i++) this.memoryBeforeRun[i] = this.memory[i];
        let stopped = false;

        while (!stopped)
        {
            this.cpu.executeCpuCycle();
            this._cpuCycleCompleted.fire();
            switch (this.runMode) {
                case RunMode.OneCycle:
                    stopped = true;
                    break;
                case RunMode.OneInstruction:
                    stopped = this.cpu.prefix == OpCodePrefix.None;
                    break;
                case RunMode.UntilHalt:
                    stopped = this.cpu.halted;
                    break;
                case RunMode.UntilEnd:
                    stopped = this.cpu.pc >= this.codeEndsAt;
                    break;
                default:
                    throw new Error("Invalid RunMode detected.")
            }
        }
    }

    /**
     * This method reads a byte from the memory.
     * @param addr Memory address
     * @returns Data byte read from the memory
     */
    readMemory(addr: number): number {
        const value = this.memory[addr];
        this.memoryAccessLog.push(new MemoryOp(addr, value, false));
        return value;
    }

    /**
     * This method writes a byte into the memory.
     * @param addr Memory address
     * @param value Byte value to write
     */
    writeMemory(addr: number, value: number): void {
        this.memory[addr] = value & 0xff;
        this.memoryAccessLog.push(new MemoryOp(addr, value, true));
    }

    /**
     * This method reads a byte from an I/O port.
     * @param addr I/O port address
     * @returns Data byte read from the I/O port
     */
    readPort(addr: number): number {
        const value = this.ioReadCount >= this.ioInputSequence.length
            ? 0x00
            : this.ioInputSequence[this.ioReadCount++];
        this.ioAccessLog.push(new IoOp(addr, value, false));
        return value;
    }

    /**
     * This method writes a byte into an I/O port
     * @param addr I/O port address
     * @param value Byte value to write
     */
    writePort(addr: number, value: number): void {
        this.ioAccessLog.push(new IoOp(addr, value, true));
    }

    /**
     * Checks if the Step-Out stack contains any information
     */
    hasStepOutInfo(): boolean {
        return this._stepOutStack.length > 0;
    }

    /**
     * The depth of the Step-Out stack
     */
    get stepOutStackDepth(): number {
        return this._stepOutStack.length;
    }

    /**
     * Clears the content of the Step-Out stack
     */
    clearStepOutStack(): void {
        this._stepOutStack.length = 0;
    }

    /**
     * Pushes the specified return address to the Step-Out stack
     * @param address Address to push to the stack
     */
    pushStepOutAddress(address: number): void {
        this._stepOutStack.push(address);
        this.stepOutPushEvents.push(address);
    }

    /**
     * Pops a Step-Out return point address from the stack
     * @returns Address popped from the stack; zero, if the Step-Out stack is empty
     */
    popStepOutAddress(): number
    {
        if (this._stepOutStack.length > 0)
        {
            this.stepOutAddress = this._stepOutStack.pop();
            this.stepOutPopEvents.push(this.stepOutAddress);
            return this.stepOutAddress;
        }
        this.stepOutAddress = undefined;
        this.stepOutPopEvents.push(0);
        return 0;
    }

    /**
     * Indicates that the last instruction executed by the CPU was a CALL
     */
    get callExecuted(): boolean {
        return this._callExecuted;
    }
    set callExecuted(value: boolean) {
        this._callExecuted = value;
        if (value) {
            this.callStepOutEvents.push(this.cpu.pc);
        }
    }

    /// <summary>
    /// Indicates that the last instruction executed by the CPU was a RET
    /// </summary>
    get retExecuted(): boolean {
        return this._retExecuted;
    }
    set retExecuted(value: boolean) {
        this._retExecuted = value;
        if (value) {
            this.retStepOutEvents.push(this.cpu.pc);
        }
    }

    /**
     * Checks if all registers keep their original values, except the ones listed in `except`
     * @param except Comma separated list of register pairs to be omitted from checks
     * @returns True, if all registers keep their values.
     * PC, WZ, and R are never checked, as they generally change during code
     * execution. You should test them manually.
     */
    shouldKeepRegisters(except?: string): void {
        const before = this.registersBeforeRun;
        const after = new Z80RegisterSnapshot(this.cpu);
        const exclude = (except?.split(",") ?? []).map(reg => reg.toUpperCase().trim());
        const differs: string[] = [];

        if (before.af_ != after.af_ && !exclude.includes("AF'")) {
            differs.push("AF'");
        }
        if (before.bc_ != after.bc_ && !exclude.includes("BC'")) {
            differs.push("BC'");
        }
        if (before.de_ != after.de_ && !exclude.includes("DE'")) {
            differs.push("DE'");
        }
        if (before.hl_ != after.hl_ && !exclude.includes("HL'")) {
            differs.push("HL'");
        }
        if (before.af != after.af &&
            !(exclude.includes("AF") || exclude.includes("A") || exclude.includes("F"))) {
            differs.push("AF");
        }
        if (before.bc != after.bc &&
            !(exclude.includes("BC") || exclude.includes("B") || exclude.includes("C"))) {
            differs.push("BC");
        }
        if (before.de != after.de &&
            !(exclude.includes("DE") || exclude.includes("D") || exclude.includes("E"))) {
            differs.push("DE");
        }
        if (before.hl != after.hl &&
            !(exclude.includes("HL") || exclude.includes("H") || exclude.includes("L"))) {
            differs.push("HL");
        }
        if (before.sp != after.sp && !exclude.includes("SP")) {
            differs.push("SP");
        }
        if (before.ix != after.ix && !exclude.includes("IX")) {
            differs.push("IX");
        }
        if (before.iy != after.iy && !exclude.includes("IY")) {
            differs.push("IY");
        }
        if (before.a != after.a && !exclude.includes("A") && !exclude.includes("AF")) {
            differs.push("A");
        }
        if (before.f != after.f && !exclude.includes("F") && !exclude.includes("AF")) {
            differs.push("F");
        }
        if (before.b != after.b && !exclude.includes("B") && !exclude.includes("BC")) {
            differs.push("B");
        }
        if (before.c != after.c && !exclude.includes("C") && !exclude.includes("BC")) {
            differs.push("C");
        }
        if (before.d != after.d && !exclude.includes("D") && !exclude.includes("DE")) {
            differs.push("D");
        }
        if (before.e != after.e && !exclude.includes("E") && !exclude.includes("DE")) {
            differs.push("E");
        }
        if (before.h != after.h && !exclude.includes("H") && !exclude.includes("HL")) {
            differs.push("H");
        }
        if (before.l != after.l && !exclude.includes("L") && !exclude.includes("HL")) {
            differs.push("L");
        }
        if (differs.length === 0) return;
        throw new Error("The following registers are expected to remain intact, " +
                    `but their values have been changed: ${differs.join(", ")}`);
    }

    /**
     * Check if the machine's memory keeps its previous values, except the addresses and address ranges specified 
     * in `except`
     * @param except Address ranges separated by comma
     */
    shouldKeepMemory(except?: string) {
        const MAX_DEVS = 10;

        const ranges: [number, number][] = [];
        const deviations: number[] = [];

        // --- Parse ranges
        const strRanges = except?.split(",") ?? [];
        for (const range of strRanges) {
            const blocks = range.split("-");
            let lower = 0xffff;
            let upper = 0xffff;
            if (blocks.length >= 1) {
                const startAddr = parseInt(blocks[0], 16);
                if (!isNaN(startAddr)) {
                    lower = upper = startAddr;
                }
            }
            if (blocks.length >= 2) {
                const endAddr = parseInt(blocks[1], 16);
                if (!isNaN(endAddr)) {
                    upper = endAddr;
                }
            }
            ranges.push([lower, upper]);
        }

        // --- Check each byte of memory, ignoring the stack
        let upperMemoryBound = this.cpu.sp;
        if (upperMemoryBound === 0) upperMemoryBound = 0x1_0000;
        for (let idx = 0; idx < upperMemoryBound; idx++) {
            if (this.memory[idx] === this.memoryBeforeRun[idx]) continue;

            // --- Test allowed deviations
            const found = ranges.some(range => idx >= range[0] && idx <= range[1]);
            if (found) continue;

            // --- Report deviation
            deviations.push(idx);
            if (deviations.length >= MAX_DEVS) break;
        }

        if (deviations.length > 0) {
            throw new Error("The following memory locations are expected to remain intact, " +
                "but their values have been changed: " +
                deviations.map(d => d.toString(16)).join(", "));
        }
    }

    /**
     * Tests if S flag keeps its value after running a test.
     */
    shouldKeepSFlag() {
        var before = (this.registersBeforeRun.f & FlagsSetMask.S) !== 0;
        var after = (this.cpu.f & FlagsSetMask.S) !== 0;
        if (after === before) {
            return;
        }
        throw new Error(`S flag expected to keep its value, but it changed from ${before} to ${after}`);
    }

    /**
     * Tests if Z flag keeps its value after running a test.
     */
    shouldKeepZFlag() {
        var before = (this.registersBeforeRun.f & FlagsSetMask.Z) !== 0;
        var after = (this.cpu.f & FlagsSetMask.Z) !== 0;
        if (after === before) {
            return;
        }
        throw new Error(`Z flag expected to keep its value, but it changed from ${before} to ${after}`);
    }

    /**
     * Tests if N flag keeps its value after running a test.
     */
    shouldKeepNFlag() {
        var before = (this.registersBeforeRun.f & FlagsSetMask.N) !== 0;
        var after = (this.cpu.f & FlagsSetMask.N) !== 0;
        if (after === before) {
            return;
        }
        throw new Error(`N flag expected to keep its value, but it changed from ${before} to ${after}`);
    }

    /**
     * Tests if PV flag keeps its value after running a test.
     */
    shouldKeepPVFlag() {
        var before = (this.registersBeforeRun.f & FlagsSetMask.PV) !== 0;
        var after = (this.cpu.f & FlagsSetMask.PV) !== 0;
        if (after === before) {
            return;
        }
        throw new Error(`PV flag expected to keep its value, but it changed from ${before} to ${after}`);
    }

    /**
     * Tests if H flag keeps its value after running a test.
     */
    shouldKeepHFlag() {
        var before = (this.registersBeforeRun.f & FlagsSetMask.H) !== 0;
        var after = (this.cpu.f & FlagsSetMask.H) !== 0;
        if (after === before) {
            return;
        }
        throw new Error(`H flag expected to keep its value, but it changed from ${before} to ${after}`);
    }

    /**
     * Tests if C flag keeps its value after running a test.
     */
    shouldKeepCFlag() {
        var before = (this.registersBeforeRun.f & FlagsSetMask.C) !== 0;
        var after = (this.cpu.f & FlagsSetMask.C) !== 0;
        if (after === before) {
            return;
        }
        throw new Error(`C flag expected to keep its value, but it changed from ${before} to ${after}`);
    }
}

/**
 * This class stores information about memory access operations.
 */
class MemoryOp {
    constructor(
        public readonly address: number,
        public readonly value: number,
        public readonly isWrite: boolean,
        ) {}
}

/**
 * This class stores information about I/O port access operations.
 */
class IoOp {
    constructor(
        public readonly address: number,
        public readonly value: number,
        public readonly isOutput: boolean,
        ) {}
}

/**
 * This class stores a snapshot of Z80 registers
 */
class Z80RegisterSnapshot {
    readonly af: number;
    readonly bc: number;
    readonly de: number;
    readonly hl: number;
    readonly af_: number;
    readonly bc_: number;
    readonly de_: number;
    readonly hl_: number;
    readonly ix: number;
    readonly iy: number;
    readonly ir: number;
    readonly pc: number;
    readonly sp: number;
    readonly wz: number;

    constructor(cpu: IZ80Cpu) {
        this.af = cpu.af;
        this.bc = cpu.bc;
        this.de = cpu.de;
        this.hl = cpu.hl;
        this.af_ = cpu.af_;
        this.bc_ = cpu.bc_;
        this.de_ = cpu.de_;
        this.hl_ = cpu.hl_;
        this.ix = cpu.ix;
        this.iy = cpu.iy;
        this.ir = cpu.ir;
        this.pc = cpu.pc;
        this.sp = cpu.sp;
        this.wz = cpu.wz;
    }

    get a(): number {
        return this.af >> 8;
    }
    get f(): number  {
        return this.af & 0xff;
    }
    get b(): number {
        return this.bc >> 8;
    }
    get c(): number  {
        return this.bc & 0xff;
    }
    get d(): number {
        return this.de >> 8;
    }
    get e(): number  {
        return this.de & 0xff;
    }
    get h(): number {
        return this.hl >> 8;
    }
    get l(): number  {
        return this.hl & 0xff;
    }
    get xh(): number {
        return this.ix >> 8;
    }
    get xl(): number  {
        return this.ix & 0xff;
    }
    get yh(): number {
        return this.yl >> 8;
    }
    get yl(): number  {
        return this.yl & 0xff;
    }
    get i(): number {
        return this.ir >> 8;
    }
    get r(): number  {
        return this.ir & 0xff;
    }
    get wh(): number {
        return this.wz >> 8;
    }
    get wl(): number  {
        return this.wz & 0xff;
    }
}

import { ILiteEvent } from "@abstractions/ILiteEvent";
import { FlagSetMask6510 } from "@emu/abstractions/FlagSetMask6510";
import { IM6510Cpu } from "@emu/abstractions/IM6510Cpu";
import { LiteEvent } from "@emu/utils/lite-event";
import { M6510Cpu } from "@emu/m6510/M6510Cpu";

/**
 * This enum defines the run modes the M6510TestMachine allows
 */
export enum RunMode {
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
   * Run until a BRK instruction is reached.
   */
  UntilBrk,

  /**
   * Run until the whole injected code is executed.
   */
  UntilEnd
}

/**
 * Implements a M6510 CPU used for testing
 */
export class M6510TestCpu extends M6510Cpu {
  constructor(private readonly machine: M6510TestMachine) {
    super();
  }

  doReadMemory(address: number): number {
    return this.machine.readMemory(address);
  }

  doWriteMemory(address: number, value: number) {
    this.machine.writeMemory(address, value);
  }

  /**
   * Override the onTactIncremented method to allow injecting custom handlers
   */
  onTactIncremented(): void {
    super.onTactIncremented();
    if (this.machine.tactIncrementHandler) {
      this.machine.tactIncrementHandler(this);
    }
  }
}

/**
 * This class implements a M6510 machine that can be used for unit testing.
 *
 * The methods of the class allow injecting and running M6510 code. Helper methods make it easy to test expected
 * behavior.
 */
export class M6510TestMachine {
  private _cpuCycleCompleted = new LiteEvent<void>();
  private _instructionCompleted = new LiteEvent<void>();

  /**
   * The M6510 CPU of the test machine
   */
  readonly cpu: M6510Cpu;

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
   * Optional handler function that gets called when a CPU tact is incremented
   */
  tactIncrementHandler?: (cpu: M6510Cpu) => void;

  /**
   * Sign that a CPU cycle has just been completed.
   */
  get cpuCycleCompleted(): ILiteEvent<void> {
    return this._cpuCycleCompleted;
  }

  /**
   * Sign that an instruction has been completed
   */
  get instructionCompleted(): ILiteEvent<void> {
    return this._instructionCompleted;
  }

  /**
   * Store the values of the M6510 registers before a test case runs.
   */
  registersBeforeRun?: M6510RegisterSnapshot;

  /**
   * Store the state of the memory before a test case runs.
   */
  memoryBeforeRun: number[] = [];

  /**
   * Initialize the test machine.
   * @param runMode Specify the mode in which the test machine runs.
   */
  constructor(
    public readonly runMode: RunMode = RunMode.Normal
  ) {
    this.memory = [];
    for (let i = 0; i < 0x1_0000; i++) this.memory[i] = 0x00;
    this.memoryAccessLog = [];
    this.ioAccessLog = [];
    this.ioInputSequence = [];
    this.ioReadCount = 0;
    this.cpu = new M6510TestCpu(this);
  }

  /**
   * Initializes the code passed in `programCode`. This code is put into the memory from `codeAddress` and code
   * execution starts at `startAddress`
   * @param programCode Bytes of the program
   * @param codeAddress Injection start address
   * @param startAddress Execution start address
   */
  initCode(programCode?: number[], codeAddress = 0, startAddress = 0): void {
    // --- Initialize the code
    if (programCode != null) {
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
  run(): void {
    this.registersBeforeRun = new M6510RegisterSnapshot(this.cpu);
    this.memoryBeforeRun = [];
    for (let i = 0; i < this.memory.length; i++)
      this.memoryBeforeRun[i] = this.memory[i];
    let stopped = false;

    while (!stopped) {
      const pcBefore = this.cpu.pc;
      this.cpu.executeCpuCycle();
      this._cpuCycleCompleted.fire();

      // Fire the instruction completed event if PC changed (instruction fetched a new opcode)
      if (this.cpu.pc !== pcBefore) {
        this._instructionCompleted.fire();
      }

      switch (this.runMode) {
        case RunMode.OneCycle:
          stopped = true;
          break;
        case RunMode.OneInstruction:
          stopped = this.cpu.pc !== pcBefore;
          break;
        case RunMode.UntilBrk:
          // Check if BRK instruction (opcode 0x00) was just executed
          stopped = this.cpu.opCode === 0x00;
          break;
        case RunMode.UntilEnd:
          stopped = this.cpu.pc >= this.codeEndsAt;
          break;
        default:
          throw new Error("Invalid RunMode detected.");
      }
    }
  }

  /**
   * This method reads a byte from the memory.
   * @param addr Memory address
   * @returns Data byte read from the memory
   */
  readMemory(addr: number): number {
    const value = this.memory[addr & 0xFFFF];
    this.memoryAccessLog.push(new MemoryOp(addr, value, false));
    return value;
  }

  /**
   * This method writes a byte into the memory.
   * @param addr Memory address
   * @param value Byte value to write
   */
  writeMemory(addr: number, value: number): void {
    this.memory[addr & 0xFFFF] = value & 0xff;
    this.memoryAccessLog.push(new MemoryOp(addr, value, true));
  }

  /**
   * This method reads a byte from an I/O port.
   * @param addr I/O port address
   * @returns Data byte read from the I/O port
   */
  readPort(addr: number): number {
    const value =
      this.ioReadCount >= this.ioInputSequence.length
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
   * Checks if all registers keep their original values, except the ones listed in `except`
   * @param except Comma separated list of register pairs to be omitted from checks
   * @returns True, if all registers keep their values.
   * PC is never checked, as it generally changes during code
   * execution. You should test it manually.
   */
  shouldKeepRegisters(except?: string): void {
    const before = this.registersBeforeRun;
    const after = new M6510RegisterSnapshot(this.cpu);
    const exclude = (except?.split(",") ?? []).map(reg =>
      reg.toUpperCase().trim()
    );
    const differs: string[] = [];

    if (
      before.a != after.a &&
      !exclude.includes("A")
    ) {
      differs.push("A");
    }
    if (
      before.x != after.x &&
      !exclude.includes("X")
    ) {
      differs.push("X");
    }
    if (
      before.y != after.y &&
      !exclude.includes("Y")
    ) {
      differs.push("Y");
    }
    if (
      before.sp != after.sp && 
      !exclude.includes("SP")
    ) {
      differs.push("SP");
    }
    if (
      before.p != after.p &&
      !exclude.includes("P")
    ) {
      differs.push("P");
    }

    if (differs.length === 0) return;
    throw new Error(
      "The following registers are expected to remain intact, " +
        `but their values have been changed: ${differs.join(", ")}`
    );
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
      throw new Error(
        "The following memory locations are expected to remain intact, " +
          "but their values have been changed: " +
          deviations.map(d => d.toString(16)).join(", ")
      );
    }
  }

  /**
   * Tests if N flag keeps its value after running a test.
   */
  shouldKeepNFlag() {
    var before = (this.registersBeforeRun.p & FlagSetMask6510.N) !== 0;
    var after = (this.cpu.p & FlagSetMask6510.N) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `N flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if V flag keeps its value after running a test.
   */
  shouldKeepVFlag() {
    var before = (this.registersBeforeRun.p & FlagSetMask6510.V) !== 0;
    var after = (this.cpu.p & FlagSetMask6510.V) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `V flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if B flag keeps its value after running a test.
   */
  shouldKeepBFlag() {
    var before = (this.registersBeforeRun.p & FlagSetMask6510.B) !== 0;
    var after = (this.cpu.p & FlagSetMask6510.B) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `B flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if D flag keeps its value after running a test.
   */
  shouldKeepDFlag() {
    var before = (this.registersBeforeRun.p & FlagSetMask6510.D) !== 0;
    var after = (this.cpu.p & FlagSetMask6510.D) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `D flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if I flag keeps its value after running a test.
   */
  shouldKeepIFlag() {
    var before = (this.registersBeforeRun.p & FlagSetMask6510.I) !== 0;
    var after = (this.cpu.p & FlagSetMask6510.I) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `I flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if Z flag keeps its value after running a test.
   */
  shouldKeepZFlag() {
    var before = (this.registersBeforeRun.p & FlagSetMask6510.Z) !== 0;
    var after = (this.cpu.p & FlagSetMask6510.Z) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `Z flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if C flag keeps its value after running a test.
   */
  shouldKeepCFlag() {
    var before = (this.registersBeforeRun.p & FlagSetMask6510.C) !== 0;
    var after = (this.cpu.p & FlagSetMask6510.C) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `C flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }
}

/**
 * This class stores information about memory access operations.
 */
class MemoryOp {
  constructor(
    public readonly address: number,
    public readonly value: number,
    public readonly isWrite: boolean
  ) {}
}

/**
 * This class stores information about I/O port access operations.
 */
class IoOp {
  constructor(
    public readonly address: number,
    public readonly value: number,
    public readonly isOutput: boolean
  ) {}
}

/**
 * This class stores a snapshot of M6510 registers
 */
class M6510RegisterSnapshot {
  readonly a: number;
  readonly x: number;
  readonly y: number;
  readonly p: number;
  readonly pc: number;
  readonly sp: number;

  constructor(cpu: IM6510Cpu) {
    this.a = cpu.a;
    this.x = cpu.x;
    this.y = cpu.y;
    this.p = cpu.p;
    this.pc = cpu.pc;
    this.sp = cpu.sp;
  }
}

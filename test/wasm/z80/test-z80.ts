import { readFileSync } from "node:fs";

import { ILiteEvent } from "@abstractions/ILiteEvent";
import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";
import { OpCodePrefix } from "@emu/abstractions/OpCodePrefix";
import { LiteEvent } from "@emu/utils/lite-event";

import { buildZ80Wasm, output as z80WasmOutput } from "./build-z80-wasm.cjs";

/**
 * This enum defines the run modes the Z80TestMachine allows
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
   * Run until a HALT instruction is reached.
   */
  UntilHalt,

  /**
   * Run until the whole injected code is executed.
   */
  UntilEnd
}

type WasmFn = (...args: number[]) => number;

type Z80WasmExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  z80Reset: WasmFn;
  z80ExecuteCpuCycle: WasmFn;
  z80GetAf: WasmFn;
  z80SetAf: WasmFn;
  z80GetBc: WasmFn;
  z80SetBc: WasmFn;
  z80GetDe: WasmFn;
  z80SetDe: WasmFn;
  z80GetHl: WasmFn;
  z80SetHl: WasmFn;
  z80GetAfAlt: WasmFn;
  z80SetAfAlt: WasmFn;
  z80GetBcAlt: WasmFn;
  z80SetBcAlt: WasmFn;
  z80GetDeAlt: WasmFn;
  z80SetDeAlt: WasmFn;
  z80GetHlAlt: WasmFn;
  z80SetHlAlt: WasmFn;
  z80GetIx: WasmFn;
  z80SetIx: WasmFn;
  z80GetIy: WasmFn;
  z80SetIy: WasmFn;
  z80GetIr: WasmFn;
  z80SetIr: WasmFn;
  z80GetWz: WasmFn;
  z80SetWz: WasmFn;
  z80GetPc: WasmFn;
  z80SetPc: WasmFn;
  z80GetSp: WasmFn;
  z80SetSp: WasmFn;
  z80GetTacts: WasmFn;
  z80SetTacts: WasmFn;
  z80GetPrefix: WasmFn;
  z80GetHalted: WasmFn;
  z80GetZ80NMode: WasmFn;
  z80SetZ80NMode: WasmFn;
  z80GetSigInt: WasmFn;
  z80SetSigInt: WasmFn;
  z80GetSigNmi: WasmFn;
  z80SetSigNmi: WasmFn;
  z80GetSigRst: WasmFn;
  z80SetSigRst: WasmFn;
  z80GetInterruptMode: WasmFn;
  z80SetInterruptMode: WasmFn;
  z80SetInterruptVector: WasmFn;
  z80GetIff1: WasmFn;
  z80SetIff1: WasmFn;
  z80GetIff2: WasmFn;
  z80SetIff2: WasmFn;
  z80GetEiBacklog: WasmFn;
  z80SetEiBacklog: WasmFn;
  z80GetRetExecuted: WasmFn;
  z80SetRetExecuted: WasmFn;
  z80GetRetnExecuted: WasmFn;
  z80SetRetnExecuted: WasmFn;
  z80TactPlusN: WasmFn;
  z80PeekMemory: WasmFn;
  z80PokeMemory: WasmFn;
  z80GetLastMemAddress: WasmFn;
  z80GetLastMemValue: WasmFn;
  z80GetLastMemIsWrite: WasmFn;
  z80GetLastPortAddress: WasmFn;
  z80GetLastPortValue: WasmFn;
  z80GetLastPortIsWrite: WasmFn;
  z80SetPortReadValue: WasmFn;
  z80GetLastTbBlueAddress: WasmFn;
  z80GetLastTbBlueValue: WasmFn;
  z80GetLastTbBlueIsWrite: WasmFn;
  z80ClearBusEvents: WasmFn;
};

let z80Module: WebAssembly.Module | undefined;

function createZ80Exports (): Z80WasmExports {
  if (z80Module == null) {
    buildZ80Wasm();
    z80Module = new WebAssembly.Module(readFileSync(z80WasmOutput));
  }
  return new WebAssembly.Instance(z80Module, {}).exports as Z80WasmExports;
}

function toByte (value: number): number {
  return value & 0xff;
}

function toWord (value: number): number {
  return value & 0xffff;
}

function getHighByte (value: number): number {
  return (value >> 8) & 0xff;
}

function getLowByte (value: number): number {
  return value & 0xff;
}

function setHighByte (word: number, value: number): number {
  return ((value & 0xff) << 8) | (word & 0xff);
}

function setLowByte (word: number, value: number): number {
  return (word & 0xff00) | (value & 0xff);
}

function isMemoryIndex (prop: string | symbol): prop is string {
  if (typeof prop !== "string" || prop.length === 0) return false;
  const address = Number(prop);
  return Number.isInteger(address) && address >= 0 && address < 0x1_0000;
}

function createMemoryProxy (cpu: Z80WasmTestCpu): number[] {
  return new Proxy([] as number[], {
    get (target, prop, receiver) {
      if (prop === "length") return 0x1_0000;
      if (isMemoryIndex(prop)) return cpu.peekMemory(Number(prop));
      return Reflect.get(target, prop, receiver);
    },
    set (target, prop, value, receiver) {
      if (isMemoryIndex(prop)) {
        cpu.pokeMemory(Number(prop), Number(value));
        return true;
      }
      return Reflect.set(target, prop, value, receiver);
    }
  });
}

class Z80WasmTestCpu {
  readonly exports: Z80WasmExports;
  readonly stepOutStack: number[] = [];
  readonly lastMemoryReads: number[] = [];
  readonly lastMemoryWrites: number[] = [];
  lastMemoryReadsCount = 0;
  lastMemoryWritesCount = 0;
  lastIoReadPort = 0;
  lastIoReadValue = 0;
  lastIoWritePort = 0;
  lastIoWriteValue = 0;

  private _opCode = 0;

  constructor (
    private readonly machine: Z80TestMachine,
    private readonly allowExtendedInstructions: boolean
  ) {
    this.exports = createZ80Exports();
    this.reset();
  }

  reset (): void {
    this.exports.z80Reset();
    this.exports.z80SetZ80NMode(this.allowExtendedInstructions ? 1 : 0);
    this.stepOutStack.length = 0;
    this.lastMemoryReads.length = 0;
    this.lastMemoryWrites.length = 0;
    this.lastMemoryReadsCount = 0;
    this.lastMemoryWritesCount = 0;
    this._opCode = 0;
  }

  hardReset (): void {
    this.reset();
  }

  executeCpuCycle (): void {
    this.lastMemoryReads.length = 0;
    this.lastMemoryWrites.length = 0;
    this.lastMemoryReadsCount = 0;
    this.lastMemoryWritesCount = 0;
    this.exports.z80ClearBusEvents();
    const pcBefore = this.pc;
    const opCodeBefore = this.peekMemory(pcBefore);
    const inputValue =
      this.machine.ioReadCount >= this.machine.ioInputSequence.length
        ? 0x00
        : this.machine.ioInputSequence[this.machine.ioReadCount];
    this.exports.z80SetPortReadValue(inputValue);
    this.exports.z80ExecuteCpuCycle();
    this.captureStepOutEvent(pcBefore, opCodeBefore);
    this.captureMemoryEvent();
    this.capturePortEvent();
    this.captureTbBlueEvent();
  }

  peekMemory (address: number): number {
    return this.exports.z80PeekMemory(toWord(address)) & 0xff;
  }

  pokeMemory (address: number, value: number): void {
    this.exports.z80PokeMemory(toWord(address), toByte(value));
  }

  setTacts (value: number): void {
    this.exports.z80SetTacts(value >>> 0);
  }

  tactPlusN (value: number): void {
    this.exports.z80TactPlusN(value >>> 0);
  }

  tactPlus1WithAddress (_address: number): void {
    this.tactPlusN(1);
  }

  tactPlus2WithAddress (_address: number): void {
    this.tactPlusN(2);
  }

  tactPlus3WithAddress (_address: number): void {
    this.tactPlusN(3);
  }

  tactPlus4WithAddress (_address: number): void {
    this.tactPlusN(4);
  }

  tactPlus5WithAddress (_address: number): void {
    this.tactPlusN(5);
  }

  tactPlus7WithAddress (_address: number): void {
    this.tactPlusN(7);
  }

  isSFlagSet (): boolean {
    return (this.f & FlagsSetMask.S) !== 0;
  }

  isZFlagSet (): boolean {
    return (this.f & FlagsSetMask.Z) !== 0;
  }

  isR5FlagSet (): boolean {
    return (this.f & FlagsSetMask.R5) !== 0;
  }

  isHFlagSet (): boolean {
    return (this.f & FlagsSetMask.H) !== 0;
  }

  isR3FlagSet (): boolean {
    return (this.f & FlagsSetMask.R3) !== 0;
  }

  isPvFlagSet (): boolean {
    return (this.f & FlagsSetMask.PV) !== 0;
  }

  isNFlagSet (): boolean {
    return (this.f & FlagsSetMask.N) !== 0;
  }

  isCFlagSet (): boolean {
    return (this.f & FlagsSetMask.C) !== 0;
  }

  get af (): number {
    return this.exports.z80GetAf() & 0xffff;
  }
  set af (value: number) {
    this.exports.z80SetAf(toWord(value));
  }

  get bc (): number {
    return this.exports.z80GetBc() & 0xffff;
  }
  set bc (value: number) {
    this.exports.z80SetBc(toWord(value));
  }

  get de (): number {
    return this.exports.z80GetDe() & 0xffff;
  }
  set de (value: number) {
    this.exports.z80SetDe(toWord(value));
  }

  get hl (): number {
    return this.exports.z80GetHl() & 0xffff;
  }
  set hl (value: number) {
    this.exports.z80SetHl(toWord(value));
  }

  get af_ (): number {
    return this.exports.z80GetAfAlt() & 0xffff;
  }
  set af_ (value: number) {
    this.exports.z80SetAfAlt(toWord(value));
  }

  get bc_ (): number {
    return this.exports.z80GetBcAlt() & 0xffff;
  }
  set bc_ (value: number) {
    this.exports.z80SetBcAlt(toWord(value));
  }

  get de_ (): number {
    return this.exports.z80GetDeAlt() & 0xffff;
  }
  set de_ (value: number) {
    this.exports.z80SetDeAlt(toWord(value));
  }

  get hl_ (): number {
    return this.exports.z80GetHlAlt() & 0xffff;
  }
  set hl_ (value: number) {
    this.exports.z80SetHlAlt(toWord(value));
  }

  get ix (): number {
    return this.exports.z80GetIx() & 0xffff;
  }
  set ix (value: number) {
    this.exports.z80SetIx(toWord(value));
  }

  get iy (): number {
    return this.exports.z80GetIy() & 0xffff;
  }
  set iy (value: number) {
    this.exports.z80SetIy(toWord(value));
  }

  get ir (): number {
    return this.exports.z80GetIr() & 0xffff;
  }
  set ir (value: number) {
    this.exports.z80SetIr(toWord(value));
  }

  get wz (): number {
    return this.exports.z80GetWz() & 0xffff;
  }
  set wz (value: number) {
    this.exports.z80SetWz(toWord(value));
  }

  get pc (): number {
    return this.exports.z80GetPc() & 0xffff;
  }
  set pc (value: number) {
    this.exports.z80SetPc(toWord(value));
  }

  get sp (): number {
    return this.exports.z80GetSp() & 0xffff;
  }
  set sp (value: number) {
    this.exports.z80SetSp(toWord(value));
  }

  get tacts (): number {
    return this.exports.z80GetTacts() >>> 0;
  }
  set tacts (value: number) {
    this.exports.z80SetTacts(value >>> 0);
  }

  get a (): number {
    return getHighByte(this.af);
  }
  set a (value: number) {
    this.af = setHighByte(this.af, value);
  }

  get f (): number {
    return getLowByte(this.af);
  }
  set f (value: number) {
    this.af = setLowByte(this.af, value);
  }

  get b (): number {
    return getHighByte(this.bc);
  }
  set b (value: number) {
    this.bc = setHighByte(this.bc, value);
  }

  get c (): number {
    return getLowByte(this.bc);
  }
  set c (value: number) {
    this.bc = setLowByte(this.bc, value);
  }

  get d (): number {
    return getHighByte(this.de);
  }
  set d (value: number) {
    this.de = setHighByte(this.de, value);
  }

  get e (): number {
    return getLowByte(this.de);
  }
  set e (value: number) {
    this.de = setLowByte(this.de, value);
  }

  get h (): number {
    return getHighByte(this.hl);
  }
  set h (value: number) {
    this.hl = setHighByte(this.hl, value);
  }

  get l (): number {
    return getLowByte(this.hl);
  }
  set l (value: number) {
    this.hl = setLowByte(this.hl, value);
  }

  get xh (): number {
    return getHighByte(this.ix);
  }
  set xh (value: number) {
    this.ix = setHighByte(this.ix, value);
  }

  get xl (): number {
    return getLowByte(this.ix);
  }
  set xl (value: number) {
    this.ix = setLowByte(this.ix, value);
  }

  get yh (): number {
    return getHighByte(this.iy);
  }
  set yh (value: number) {
    this.iy = setHighByte(this.iy, value);
  }

  get yl (): number {
    return getLowByte(this.iy);
  }
  set yl (value: number) {
    this.iy = setLowByte(this.iy, value);
  }

  get i (): number {
    return getHighByte(this.ir);
  }
  set i (value: number) {
    this.ir = setHighByte(this.ir, value);
  }

  get r (): number {
    return getLowByte(this.ir);
  }
  set r (value: number) {
    this.ir = setLowByte(this.ir, value);
  }

  get wh (): number {
    return getHighByte(this.wz);
  }
  set wh (value: number) {
    this.wz = setHighByte(this.wz, value);
  }

  get wl (): number {
    return getLowByte(this.wz);
  }
  set wl (value: number) {
    this.wz = setLowByte(this.wz, value);
  }

  get prefix (): OpCodePrefix {
    return this.exports.z80GetPrefix() as OpCodePrefix;
  }

  get opCode (): number {
    return this._opCode;
  }

  get halted (): boolean {
    return this.exports.z80GetHalted() !== 0;
  }

  get z80NMode (): boolean {
    return this.exports.z80GetZ80NMode() !== 0;
  }
  set z80NMode (value: boolean) {
    this.exports.z80SetZ80NMode(value ? 1 : 0);
  }

  get sigINT (): boolean {
    return this.exports.z80GetSigInt() !== 0;
  }
  set sigINT (value: boolean) {
    this.exports.z80SetSigInt(value ? 1 : 0);
  }

  get sigNMI (): boolean {
    return this.exports.z80GetSigNmi() !== 0;
  }
  set sigNMI (value: boolean) {
    this.exports.z80SetSigNmi(value ? 1 : 0);
  }

  get sigRST (): boolean {
    return this.exports.z80GetSigRst() !== 0;
  }
  set sigRST (value: boolean) {
    this.exports.z80SetSigRst(value ? 1 : 0);
  }

  get interruptMode (): number {
    return this.exports.z80GetInterruptMode() & 0x03;
  }
  set interruptMode (value: number) {
    this.exports.z80SetInterruptMode(value);
  }

  set interruptVector (value: number) {
    this.exports.z80SetInterruptVector(value);
  }

  get iff1 (): boolean {
    return this.exports.z80GetIff1() !== 0;
  }
  set iff1 (value: boolean) {
    this.exports.z80SetIff1(value ? 1 : 0);
  }

  get iff2 (): boolean {
    return this.exports.z80GetIff2() !== 0;
  }
  set iff2 (value: boolean) {
    this.exports.z80SetIff2(value ? 1 : 0);
  }

  get eiBacklog (): number {
    return this.exports.z80GetEiBacklog() & 0xff;
  }
  set eiBacklog (value: number) {
    this.exports.z80SetEiBacklog(toByte(value));
  }

  get retExecuted (): boolean {
    return this.exports.z80GetRetExecuted() !== 0;
  }
  set retExecuted (value: boolean) {
    this.exports.z80SetRetExecuted(value ? 1 : 0);
  }

  get retnExecuted (): boolean {
    return this.exports.z80GetRetnExecuted() !== 0;
  }
  set retnExecuted (value: boolean) {
    this.exports.z80SetRetnExecuted(value ? 1 : 0);
  }

  private captureMemoryEvent (): void {
    const address = this.exports.z80GetLastMemAddress() & 0xffff;
    const value = this.exports.z80GetLastMemValue() & 0xff;
    const isWrite = this.exports.z80GetLastMemIsWrite() !== 0;
    if (address === 0 && value === 0 && !isWrite) return;
    if (isWrite) {
      this.lastMemoryWrites.push(address, value);
      this.lastMemoryWritesCount++;
    } else {
      this.lastMemoryReads.push(address, value);
      this.lastMemoryReadsCount++;
    }
  }

  private captureStepOutEvent (pcBefore: number, opCodeBefore: number): void {
    if ((opCodeBefore & 0xc7) === 0xc7) {
      this.stepOutStack.push(toWord(pcBefore + 1));
      return;
    }

    if ((opCodeBefore === 0xcd || (opCodeBefore & 0xc7) === 0xc4) && this.pc !== toWord(pcBefore + 3)) {
      this.stepOutStack.push(toWord(pcBefore + 3));
    }
  }

  private capturePortEvent (): void {
    const address = this.exports.z80GetLastPortAddress() & 0xffff;
    const value = this.exports.z80GetLastPortValue() & 0xff;
    const isWrite = this.exports.z80GetLastPortIsWrite() !== 0;
    if (address === 0 && value === 0 && !isWrite) return;
    if (isWrite) {
      this.lastIoWritePort = address;
      this.lastIoWriteValue = value;
      this.machine.writePort(address, value);
    } else {
      this.lastIoReadPort = address;
      this.lastIoReadValue = value;
      this.machine.ioReadCount++;
      this.machine.ioAccessLog.push(new IoOp(address, value, false));
    }
  }

  private captureTbBlueEvent (): void {
    const address = this.exports.z80GetLastTbBlueAddress() & 0xff;
    const value = this.exports.z80GetLastTbBlueValue() & 0xff;
    const isWrite = this.exports.z80GetLastTbBlueIsWrite() !== 0;
    if (!isWrite) return;
    this.machine.writeTbBlue(address, value);
  }
}

/**
 * Implements a Z80 CPU used for testing
 */
export class Z80TestCpu extends Z80WasmTestCpu {
  constructor (machine: Z80TestMachine) {
    super(machine, false);
  }
}

/**
 * Implements a Z80N CPU used for testing
 */
export class Z80NTestCpu extends Z80WasmTestCpu {
  constructor (machine: Z80TestMachine) {
    super(machine, true);
  }
}

/**
 * This class implements a Z80 machine that can be used for unit testing.
 *
 * The methods of the class allow injecting and running Z80 code. Helper methods make it easy to test expected
 * behavior.
 */
export class Z80TestMachine {
  private readonly _stepOutStack: number[] = [];
  private _callExecuted = false;
  private _retExecuted = false;
  private _cpuCycleCompleted = new LiteEvent<void>();

  /**
   * The Z80 CPU of the test machine
   */
  readonly cpu: Z80TestCpu | Z80NTestCpu;

  /**
   * The operative memory of the test machine
   */
  readonly memory: number[];

  /**
   * The address where the code execution ends.
   */
  codeEndsAt = 0;

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
   * Log that helps testing TBBlue I/O access operations.
   */
  tbBlueAccessLog: IoOp[] = [];

  /**
   * Sign that a CPU cycle has just been completed.
   */
  get cpuCycleCompleted (): ILiteEvent<void> {
    return this._cpuCycleCompleted;
  }

  /**
   * Store the values of the Z80 registers before a test case runs.
   */
  registersBeforeRun?: Z80RegisterSnapshot;

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
  constructor (
    public readonly runMode: RunMode = RunMode.Normal,
    public readonly allowExtendedInstructions = false
  ) {
    this.memoryAccessLog = [];
    this.ioAccessLog = [];
    this.ioInputSequence = [];
    this.ioReadCount = 0;
    this.cpu = allowExtendedInstructions ? new Z80NTestCpu(this) : new Z80TestCpu(this);
    this.memory = createMemoryProxy(this.cpu);
  }

  /**
   * Initializes the code passed in `programCode`. This code is put into the memory from `codeAddress` and code
   * execution starts at `startAddress`
   * @param programCode Bytes of the program
   * @param codeAddress Injection start address
   * @param startAddress Execution start address
   */
  initCode (programCode?: number[], codeAddress = 0, startAddress = 0): void {
    if (programCode != null) {
      for (const op of programCode) {
        this.memory[codeAddress++] = op;
      }
      this.codeEndsAt = codeAddress;
      while (codeAddress < 0xffff) {
        this.memory[codeAddress++] = 0;
      }
    }

    this.cpu.reset();
    this.cpu.pc = startAddress;
  }

  /**
   * Run the injected code.
   */
  run (): void {
    this.registersBeforeRun = new Z80RegisterSnapshot(this.cpu);
    this.memoryBeforeRun = [];
    for (let i = 0; i < this.memory.length; i++)
      this.memoryBeforeRun[i] = this.memory[i];
    let stopped = false;

    while (!stopped) {
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
          throw new Error("Invalid RunMode detected.");
      }
    }
  }

  /**
   * This method reads a byte from the memory.
   * @param addr Memory address
   * @returns Data byte read from the memory
   */
  readMemory (addr: number): number {
    const value = this.memory[addr];
    this.memoryAccessLog.push(new MemoryOp(addr, value, false));
    return value;
  }

  /**
   * This method writes a byte into the memory.
   * @param addr Memory address
   * @param value Byte value to write
   */
  writeMemory (addr: number, value: number): void {
    this.memory[addr] = value & 0xff;
    this.memoryAccessLog.push(new MemoryOp(addr, value, true));
  }

  /**
   * This method reads a byte from an I/O port.
   * @param addr I/O port address
   * @returns Data byte read from the I/O port
   */
  readPort (addr: number): number {
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
  writePort (addr: number, value: number): void {
    this.ioAccessLog.push(new IoOp(addr, value, true));
  }

  /**
   * This method writes a byte into the specified TBBLUE register
   * @param addr TBBLUE register address
   * @param value Byte value to write
   */
  writeTbBlue (addr: number, value: number): void {
    this.tbBlueAccessLog.push(new IoOp(addr, value, true));
  }

  /**
   * Checks if the Step-Out stack contains any information
   */
  hasStepOutInfo (): boolean {
    return this._stepOutStack.length > 0;
  }

  /**
   * The depth of the Step-Out stack
   */
  get stepOutStackDepth (): number {
    return this._stepOutStack.length;
  }

  /**
   * Clears the content of the Step-Out stack
   */
  clearStepOutStack (): void {
    this._stepOutStack.length = 0;
    this.cpu.stepOutStack.length = 0;
  }

  /**
   * Pushes the specified return address to the Step-Out stack
   * @param address Address to push to the stack
   */
  pushStepOutAddress (address: number): void {
    const normalizedAddress = toWord(address);
    this._stepOutStack.push(normalizedAddress);
    this.cpu.stepOutStack.push(normalizedAddress);
    this.stepOutPushEvents.push(normalizedAddress);
  }

  /**
   * Pops a Step-Out return point address from the stack
   * @returns Address popped from the stack; zero, if the Step-Out stack is empty
   */
  popStepOutAddress (): number {
    if (this._stepOutStack.length > 0) {
      this.stepOutAddress = this._stepOutStack.pop();
      this.cpu.stepOutStack.pop();
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
  get callExecuted (): boolean {
    return this._callExecuted;
  }
  set callExecuted (value: boolean) {
    this._callExecuted = value;
    if (value) {
      this.callStepOutEvents.push(this.cpu.pc);
    }
  }

  /// <summary>
  /// Indicates that the last instruction executed by the CPU was a RET
  /// </summary>
  get retExecuted (): boolean {
    return this._retExecuted;
  }
  set retExecuted (value: boolean) {
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
  shouldKeepRegisters (except?: string): void {
    const before = this.registersBeforeRun;
    const after = new Z80RegisterSnapshot(this.cpu);
    const exclude = (except?.split(",") ?? []).map(reg =>
      reg.toUpperCase().trim()
    );
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
    if (
      before.af != after.af &&
      !(
        exclude.includes("AF") ||
        exclude.includes("A") ||
        exclude.includes("F")
      )
    ) {
      differs.push("AF");
    }
    if (
      before.bc != after.bc &&
      !(
        exclude.includes("BC") ||
        exclude.includes("B") ||
        exclude.includes("C")
      )
    ) {
      differs.push("BC");
    }
    if (
      before.de != after.de &&
      !(
        exclude.includes("DE") ||
        exclude.includes("D") ||
        exclude.includes("E")
      )
    ) {
      differs.push("DE");
    }
    if (
      before.hl != after.hl &&
      !(
        exclude.includes("HL") ||
        exclude.includes("H") ||
        exclude.includes("L")
      )
    ) {
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
    if (
      before.a != after.a &&
      !exclude.includes("A") &&
      !exclude.includes("AF")
    ) {
      differs.push("A");
    }
    if (
      before.f != after.f &&
      !exclude.includes("F") &&
      !exclude.includes("AF")
    ) {
      differs.push("F");
    }
    if (
      before.b != after.b &&
      !exclude.includes("B") &&
      !exclude.includes("BC")
    ) {
      differs.push("B");
    }
    if (
      before.c != after.c &&
      !exclude.includes("C") &&
      !exclude.includes("BC")
    ) {
      differs.push("C");
    }
    if (
      before.d != after.d &&
      !exclude.includes("D") &&
      !exclude.includes("DE")
    ) {
      differs.push("D");
    }
    if (
      before.e != after.e &&
      !exclude.includes("E") &&
      !exclude.includes("DE")
    ) {
      differs.push("E");
    }
    if (
      before.h != after.h &&
      !exclude.includes("H") &&
      !exclude.includes("HL")
    ) {
      differs.push("H");
    }
    if (
      before.l != after.l &&
      !exclude.includes("L") &&
      !exclude.includes("HL")
    ) {
      differs.push("L");
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
  shouldKeepMemory (except?: string) {
    const MAX_DEVS = 10;

    const ranges: [number, number][] = [];
    const deviations: number[] = [];

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

    let upperMemoryBound = this.cpu.sp;
    if (upperMemoryBound === 0) upperMemoryBound = 0x1_0000;
    for (let idx = 0; idx < upperMemoryBound; idx++) {
      if (this.memory[idx] === this.memoryBeforeRun[idx]) continue;

      const found = ranges.some(range => idx >= range[0] && idx <= range[1]);
      if (found) continue;

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
   * Tests if S flag keeps its value after running a test.
   */
  shouldKeepSFlag () {
    var before = (this.registersBeforeRun.f & FlagsSetMask.S) !== 0;
    var after = (this.cpu.f & FlagsSetMask.S) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `S flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if Z flag keeps its value after running a test.
   */
  shouldKeepZFlag () {
    var before = (this.registersBeforeRun.f & FlagsSetMask.Z) !== 0;
    var after = (this.cpu.f & FlagsSetMask.Z) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `Z flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if N flag keeps its value after running a test.
   */
  shouldKeepNFlag () {
    var before = (this.registersBeforeRun.f & FlagsSetMask.N) !== 0;
    var after = (this.cpu.f & FlagsSetMask.N) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `N flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if PV flag keeps its value after running a test.
   */
  shouldKeepPVFlag () {
    var before = (this.registersBeforeRun.f & FlagsSetMask.PV) !== 0;
    var after = (this.cpu.f & FlagsSetMask.PV) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `PV flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if H flag keeps its value after running a test.
   */
  shouldKeepHFlag () {
    var before = (this.registersBeforeRun.f & FlagsSetMask.H) !== 0;
    var after = (this.cpu.f & FlagsSetMask.H) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `H flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if C flag keeps its value after running a test.
   */
  shouldKeepCFlag () {
    var before = (this.registersBeforeRun.f & FlagsSetMask.C) !== 0;
    var after = (this.cpu.f & FlagsSetMask.C) !== 0;
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
  constructor (
    public readonly address: number,
    public readonly value: number,
    public readonly isWrite: boolean
  ) {}
}

/**
 * This class stores information about I/O port access operations.
 */
class IoOp {
  constructor (
    public readonly address: number,
    public readonly value: number,
    public readonly isOutput: boolean
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

  constructor (cpu: Z80WasmTestCpu) {
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

  get a (): number {
    return this.af >> 8;
  }
  get f (): number {
    return this.af & 0xff;
  }
  get b (): number {
    return this.bc >> 8;
  }
  get c (): number {
    return this.bc & 0xff;
  }
  get d (): number {
    return this.de >> 8;
  }
  get e (): number {
    return this.de & 0xff;
  }
  get h (): number {
    return this.hl >> 8;
  }
  get l (): number {
    return this.hl & 0xff;
  }
  get xh (): number {
    return this.ix >> 8;
  }
  get xl (): number {
    return this.ix & 0xff;
  }
  get yh (): number {
    return this.iy >> 8;
  }
  get yl (): number {
    return this.iy & 0xff;
  }
  get i (): number {
    return this.ir >> 8;
  }
  get r (): number {
    return this.ir & 0xff;
  }
  get wh (): number {
    return this.wz >> 8;
  }
  get wl (): number {
    return this.wz & 0xff;
  }
}

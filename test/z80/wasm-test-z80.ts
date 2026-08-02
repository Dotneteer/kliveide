import { readFileSync } from "node:fs";
import { buildSp48Wasm, output } from "../../scripts/build-sp48-wasm.cjs";

export enum RunMode {
  Normal,
  OneCycle,
  OneInstruction,
  UntilHalt,
  UntilEnd
}

const word = {
  af: 0, bc: 1, de: 2, hl: 3, afAlt: 4, bcAlt: 5, deAlt: 6, hlAlt: 7,
  ix: 8, iy: 9, ir: 10, wz: 11, pc: 12, sp: 13
} as const;
const byte = { a: 0, f: 1, b: 2, c: 3, d: 4, e: 5, h: 6, l: 7 } as const;
const control = { prefix: 0, halted: 1, iff1: 4, iff2: 5 } as const;
const counter = { tacts: 0 } as const;

export interface IoAccessLogEntry {
  address: number;
  value: number;
  isOutput: boolean;
}

export interface MemoryAccessLogEntry {
  address: number;
  value: number;
  isWrite: boolean;
}

type WasmExports = Record<string, WebAssembly.ExportValue>;
let module: WebAssembly.Module | undefined;

function createWasm (): WasmExports {
  if (module == null) {
    buildSp48Wasm();
    module = new WebAssembly.Module(readFileSync(output));
  }
  return new WebAssembly.Instance(module).exports as WasmExports;
}

class Z80WasmTestCpu {
  readonly stepOutStack: number[] = [];
  codeByteAt?: (address: number) => number;

  constructor (private readonly wasm: WasmExports) {}

  private call (name: string, ...args: number[]): number {
    return (this.wasm[name] as CallableFunction)(...args) as number;
  }

  private readWord (field: number): number { return this.call("z80_state_read_word", field); }
  private writeWord (field: number, value: number): void { this.call("z80_state_write_word", field, value); }
  private readByte (field: number): number { return this.call("z80_state_read_byte", field); }
  private writeByte (field: number, value: number): void { this.call("z80_state_write_byte", field, value); }

  reset (): void { this.call("z80_reset"); }
  executeCpuCycle (): number {
    const startPc = this.pc;
    const opcode = this.codeByteAt?.(startPc);
    const result = this.call("z80_execute_instruction");
    if (opcode != null && (opcode === 0xcd || ((opcode & 0xc7) === 0xc4 && this.pc !== ((startPc + 3) & 0xffff)) || (opcode & 0xc7) === 0xc7)) {
      this.stepOutStack.push((startPc + ((opcode & 0xc7) === 0xc7 ? 1 : 3)) & 0xffff);
    }
    return result;
  }

  get af (): number { return this.readWord(word.af); }
  set af (value: number) { this.writeWord(word.af, value); }
  get bc (): number { return this.readWord(word.bc); }
  set bc (value: number) { this.writeWord(word.bc, value); }
  get de (): number { return this.readWord(word.de); }
  set de (value: number) { this.writeWord(word.de, value); }
  get hl (): number { return this.readWord(word.hl); }
  set hl (value: number) { this.writeWord(word.hl, value); }
  get af_ (): number { return this.readWord(word.afAlt); }
  set af_ (value: number) { this.writeWord(word.afAlt, value); }
  get bc_ (): number { return this.readWord(word.bcAlt); }
  set bc_ (value: number) { this.writeWord(word.bcAlt, value); }
  get de_ (): number { return this.readWord(word.deAlt); }
  set de_ (value: number) { this.writeWord(word.deAlt, value); }
  get hl_ (): number { return this.readWord(word.hlAlt); }
  set hl_ (value: number) { this.writeWord(word.hlAlt, value); }
  get ix (): number { return this.readWord(word.ix); }
  get iy (): number { return this.readWord(word.iy); }
  get ir (): number { return this.readWord(word.ir); }
  get wz (): number { return this.readWord(word.wz); }
  get wh (): number { return this.wz >> 8; }
  get sp (): number { return this.readWord(word.sp); }
  set sp (value: number) { this.writeWord(word.sp, value); }
  get pc (): number { return this.readWord(word.pc); }
  set pc (value: number) { this.writeWord(word.pc, value); }
  get a (): number { return this.readByte(byte.a); }
  set a (value: number) { this.writeByte(byte.a, value); }
  get f (): number { return this.readByte(byte.f); }
  set f (value: number) { this.writeByte(byte.f, value); }
  get b (): number { return this.readByte(byte.b); }
  set b (value: number) { this.writeByte(byte.b, value); }
  get c (): number { return this.readByte(byte.c); }
  set c (value: number) { this.writeByte(byte.c, value); }
  get d (): number { return this.readByte(byte.d); }
  set d (value: number) { this.writeByte(byte.d, value); }
  get e (): number { return this.readByte(byte.e); }
  set e (value: number) { this.writeByte(byte.e, value); }
  get h (): number { return this.readByte(byte.h); }
  set h (value: number) { this.writeByte(byte.h, value); }
  get l (): number { return this.readByte(byte.l); }
  set l (value: number) { this.writeByte(byte.l, value); }
  get tacts (): number { return this.call("z80_state_read_counter", counter.tacts); }
  get prefix (): number { return this.call("z80_state_read_control", control.prefix); }
  get halted (): boolean { return this.call("z80_state_read_control", control.halted) !== 0; }
  get iff1 (): boolean { return this.call("z80_state_read_control", control.iff1) !== 0; }
  set iff1 (value: boolean) { this.call("z80_state_write_control", control.iff1, value ? 1 : 0); }
  get iff2 (): boolean { return this.call("z80_state_read_control", control.iff2) !== 0; }
  set iff2 (value: boolean) { this.call("z80_state_write_control", control.iff2, value ? 1 : 0); }
  isSFlagSet (): boolean { return (this.f & 0x80) !== 0; }
  isZFlagSet (): boolean { return (this.f & 0x40) !== 0; }
  isHFlagSet (): boolean { return (this.f & 0x10) !== 0; }
  isPvFlagSet (): boolean { return (this.f & 0x04) !== 0; }
  isNFlagSet (): boolean { return (this.f & 0x02) !== 0; }
  isCFlagSet (): boolean { return (this.f & 0x01) !== 0; }
}

type Snapshot = Record<"af" | "bc" | "de" | "hl" | "af_" | "bc_" | "de_" | "hl_" | "ix" | "iy" | "sp", number>;

/** Test-only replacement for the TypeScript test machine. Opcode-page clones
 * import this class; their test bodies remain byte-for-byte identical. */
export class Z80TestMachine {
  readonly cpu: Z80WasmTestCpu;
  readonly memory: Uint8Array;
  readonly ioInputSequence: number[] = [];
  codeEndsAt = 0;
  registersBeforeRun?: Snapshot;
  memoryBeforeRun = new Uint8Array(0x10000);

  private readonly wasm: WasmExports;
  private readonly ioInput: Uint8Array;

  constructor (public readonly runMode: RunMode = RunMode.Normal) {
    const wasm = createWasm();
    this.wasm = wasm;
    this.cpu = new Z80WasmTestCpu(wasm);
    const memoryStart = (wasm.z80_test_memory_ptr as CallableFunction)() as number;
    this.memory = new Uint8Array((wasm.memory as WebAssembly.Memory).buffer, memoryStart, 0x10000);
    const ioInputStart = (wasm.z80_test_io_input_ptr as CallableFunction)() as number;
    this.ioInput = new Uint8Array((wasm.memory as WebAssembly.Memory).buffer, ioInputStart, 256);
    this.cpu.codeByteAt = address => this.memory[address];
  }

  get ioAccessLog (): IoAccessLogEntry[] {
    const count = (this.wasm.z80_test_io_log_count as CallableFunction)() as number;
    const start = (this.wasm.z80_test_io_log_ptr as CallableFunction)() as number;
    const view = new DataView((this.wasm.memory as WebAssembly.Memory).buffer, start, count * 4);
    const entries: IoAccessLogEntry[] = [];

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      entries.push({
        address: view.getUint16(offset, true),
        value: view.getUint8(offset + 2),
        isOutput: view.getUint8(offset + 3) !== 0
      });
    }
    return entries;
  }

  get memoryAccessLog (): MemoryAccessLogEntry[] {
    const count = (this.wasm.z80_test_memory_log_count as CallableFunction)() as number;
    const start = (this.wasm.z80_test_memory_log_ptr as CallableFunction)() as number;
    const view = new DataView((this.wasm.memory as WebAssembly.Memory).buffer, start, count * 4);
    const entries: MemoryAccessLogEntry[] = [];

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      entries.push({
        address: view.getUint16(offset, true),
        value: view.getUint8(offset + 2),
        isWrite: view.getUint8(offset + 3) !== 0
      });
    }
    return entries;
  }

  initCode (programCode?: number[], codeAddress = 0, startAddress = 0): void {
    (this.wasm.z80_test_bus_reset as CallableFunction)();
    this.memory.fill(0);
    if (programCode != null) {
      this.memory.set(programCode, codeAddress);
      this.codeEndsAt = codeAddress + programCode.length;
    }
    this.cpu.reset();
    this.cpu.pc = startAddress;
  }

  run (): void {
    this.ioInput.fill(0);
    this.ioInput.set(this.ioInputSequence.slice(0, this.ioInput.length));
    (this.wasm.z80_test_io_input_count_set as CallableFunction)(this.ioInputSequence.length);
    this.registersBeforeRun = this.snapshot();
    this.memoryBeforeRun = new Uint8Array(this.memory);
    for (;;) {
      const result = this.cpu.executeCpuCycle();
      if (result === 1) throw new Error(`WASM Z80 opcode at ${this.cpu.pc.toString(16)} is not implemented`);
      if (this.runMode === RunMode.OneCycle) return;
      if (this.runMode === RunMode.OneInstruction && this.cpu.prefix === 0) return;
      if (this.runMode === RunMode.UntilHalt && this.cpu.halted) return;
      if (this.runMode === RunMode.UntilEnd && this.cpu.pc >= this.codeEndsAt) return;
      if (this.runMode === RunMode.Normal) throw new Error("Invalid RunMode detected.");
    }
  }

  shouldKeepRegisters (except?: string): void {
    const before = this.registersBeforeRun!;
    const after = this.snapshot();
    const excluded = (except?.split(",") ?? []).map(value => value.trim().toUpperCase());
    const pairs: Array<[keyof Snapshot, string, string[]]> = [
      ["af_", "AF'", ["AF'"]], ["bc_", "BC'", ["BC'"]], ["de_", "DE'", ["DE'"]], ["hl_", "HL'", ["HL'"]],
      ["af", "AF", ["AF", "A", "F"]], ["bc", "BC", ["BC", "B", "C"]], ["de", "DE", ["DE", "D", "E"]], ["hl", "HL", ["HL", "H", "L"]],
      ["sp", "SP", ["SP"]], ["ix", "IX", ["IX"]], ["iy", "IY", ["IY"]]
    ];
    const differs = pairs.filter(([key, , names]) => before[key] !== after[key] && !names.some(name => excluded.includes(name))).map(([, name]) => name);
    if (differs.length > 0) throw new Error(`The following registers are expected to remain intact, but their values have been changed: ${differs.join(", ")}`);
  }

  shouldKeepMemory (except?: string): void {
    const ranges = (except?.split(",") ?? []).map(range => {
      const [start, end] = range.split("-");
      const lower = Number.parseInt(start, 16);
      const upper = end == null ? lower : Number.parseInt(end, 16);
      return [lower, upper] as const;
    });
    const upperBound = this.cpu.sp === 0 ? 0x10000 : this.cpu.sp;
    const deviations: number[] = [];
    for (let address = 0; address < upperBound && deviations.length < 10; address++) {
      if (this.memory[address] !== this.memoryBeforeRun[address] && !ranges.some(([from, to]) => address >= from && address <= to)) deviations.push(address);
    }
    if (deviations.length > 0) throw new Error(`The following memory locations are expected to remain intact, but their values have been changed: ${deviations.map(address => address.toString(16)).join(", ")}`);
  }

  shouldKeepSFlag (): void { this.shouldKeepFlag(0x80, "S"); }
  shouldKeepZFlag (): void { this.shouldKeepFlag(0x40, "Z"); }
  shouldKeepPVFlag (): void { this.shouldKeepFlag(0x04, "PV"); }
  shouldKeepHFlag (): void { this.shouldKeepFlag(0x10, "H"); }
  shouldKeepCFlag (): void { this.shouldKeepFlag(0x01, "C"); }

  private snapshot (): Snapshot {
    const { cpu } = this;
    return { af: cpu.af, bc: cpu.bc, de: cpu.de, hl: cpu.hl, af_: cpu.af_, bc_: cpu.bc_, de_: cpu.de_, hl_: cpu.hl_, ix: cpu.ix, iy: cpu.iy, sp: cpu.sp };
  }

  private shouldKeepFlag (mask: number, name: string): void {
    const before = (this.registersBeforeRun!.af & mask) !== 0;
    const after = (this.cpu.f & mask) !== 0;
    if (before !== after) throw new Error(`${name} flag expected to keep its value, but it changed from ${before} to ${after}`);
  }
}

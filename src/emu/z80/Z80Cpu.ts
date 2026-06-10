import { readFileSync } from "fs";
import { resolve } from "path";
import { FlagsSetMask } from "../abstractions/FlagSetMask";

type Z80WasmExports = {
  memory: WebAssembly.Memory;
  z80MemoryPtr: () => number;
  z80Reset: () => void;
  z80ExecuteCpuCycle: () => void;
  z80GetTacts: () => number;
  z80SetTacts: (value: number) => void;
  z80GetAf: () => number;
  z80SetAf: (value: number) => void;
  z80GetBc: () => number;
  z80SetBc: (value: number) => void;
  z80GetDe: () => number;
  z80SetDe: (value: number) => void;
  z80GetHl: () => number;
  z80SetHl: (value: number) => void;
  z80GetAfAlt: () => number;
  z80SetAfAlt: (value: number) => void;
  z80GetBcAlt: () => number;
  z80SetBcAlt: (value: number) => void;
  z80GetDeAlt: () => number;
  z80SetDeAlt: (value: number) => void;
  z80GetHlAlt: () => number;
  z80SetHlAlt: (value: number) => void;
  z80GetIx: () => number;
  z80SetIx: (value: number) => void;
  z80GetIy: () => number;
  z80SetIy: (value: number) => void;
  z80GetIr: () => number;
  z80SetIr: (value: number) => void;
  z80GetWz: () => number;
  z80SetWz: (value: number) => void;
  z80GetPc: () => number;
  z80SetPc: (value: number) => void;
  z80GetSp: () => number;
  z80SetSp: (value: number) => void;
  z80GetPrefix: () => number;
  z80GetHalted: () => number;
  z80GetZ80NMode: () => number;
  z80SetZ80NMode: (value: number) => void;
  z80GetSigInt: () => number;
  z80SetSigInt: (value: number) => void;
  z80GetSigNmi: () => number;
  z80SetSigNmi: (value: number) => void;
  z80GetSigRst: () => number;
  z80SetSigRst: (value: number) => void;
  z80GetInterruptMode: () => number;
  z80SetInterruptMode: (value: number) => void;
  z80SetInterruptVector: (value: number) => void;
  z80GetIff1: () => number;
  z80SetIff1: (value: number) => void;
  z80GetIff2: () => number;
  z80SetIff2: (value: number) => void;
  z80GetEiBacklog: () => number;
  z80SetEiBacklog: (value: number) => void;
  z80GetRetExecuted: () => number;
  z80SetRetExecuted: (value: number) => void;
  z80GetRetnExecuted: () => number;
  z80SetRetnExecuted: (value: number) => void;
  z80TactPlusN: (value: number) => void;
  z80GetLastPortAddress: () => number;
  z80GetLastPortValue: () => number;
  z80GetLastPortIsWrite: () => number;
  z80GetLastTbBlueAddress: () => number;
  z80GetLastTbBlueValue: () => number;
  z80GetLastTbBlueIsWrite: () => number;
  z80SetPortReadValue: (value: number) => void;
  z80ClearBusEvents: () => void;
};

let exportsCache: Z80WasmExports | undefined;
let memoryCache: Uint8Array | undefined;

function getExports(): Z80WasmExports {
  if (!exportsCache) {
    const wasmPath = resolve(process.cwd(), "public/wasm/z80.wasm");
    const module = new WebAssembly.Module(readFileSync(wasmPath));
    exportsCache = new WebAssembly.Instance(module, {}).exports as Z80WasmExports;
  }
  return exportsCache;
}

export function getZ80Memory(): Uint8Array {
  const exports = getExports();
  const memoryPtr = exports.z80MemoryPtr();
  if (!memoryCache || memoryCache.buffer !== exports.memory.buffer) {
    memoryCache = new Uint8Array(exports.memory.buffer, memoryPtr, 0x10000);
  }
  return memoryCache;
}

export class Z80Cpu {
  protected readonly wasm = getExports();
  private readonly memory = getZ80Memory();
  readonly stepOutStack: number[] = [];
  allowExtendedInstructions = false;

  reset(): void {
    this.stepOutStack.length = 0;
    this.wasm.z80Reset();
    this.wasm.z80SetZ80NMode(this.allowExtendedInstructions ? 1 : 0);
  }

  executeCpuCycle(): void {
    this.wasm.z80ClearBusEvents();
    this.prepareInterrupt();
    this.prepareStepOut();
    this.preparePortInput();
    this.wasm.z80ExecuteCpuCycle();
    this.flushPortOutput();
    this.flushTbBlueOutput();
  }

  doReadMemory(_address: number): number {
    return 0;
  }

  doWriteMemory(_address: number, _value: number): void {}

  doReadPort(_address: number): number {
    return 0;
  }

  doWritePort(_address: number, _value: number): void {}

  protected getInterruptVector(): number {
    return 0xff;
  }

  onInterruptAcknowledged(): void {}

  private prepareInterrupt(): void {
    if (this.sigNMI || !this.sigINT || this.prefix !== 0 || !this.iff1) {
      return;
    }
    const backlogAfterCycleStart = this.eiBacklog > 0 ? this.eiBacklog - 1 : 0;
    if (backlogAfterCycleStart !== 0) {
      return;
    }
    this.wasm.z80SetInterruptVector(this.getInterruptVector());
    this.onInterruptAcknowledged();
  }

  private preparePortInput(): void {
    if (this.prefix === 1) {
      const opCode = this.memory[this.pc];
      if (this.allowExtendedInstructions && opCode === 0x98) {
        this.wasm.z80SetPortReadValue(this.doReadPort(this.bc));
        return;
      }
      if ([0x40, 0x48, 0x50, 0x58, 0x60, 0x68, 0x70, 0x78, 0xa2, 0xaa, 0xb2, 0xba].includes(opCode)) {
        this.wasm.z80SetPortReadValue(this.doReadPort(this.bc));
      }
      return;
    }
    if (![0, 3, 4].includes(this.prefix) || this.memory[this.pc] !== 0xdb) {
      return;
    }
    const portLow = this.memory[(this.pc + 1) & 0xffff];
    const port = ((this.a << 8) | portLow) & 0xffff;
    this.wasm.z80SetPortReadValue(this.doReadPort(port));
  }

  private prepareStepOut(): void {
    if (this.prefix !== 0) {
      return;
    }
    const pc = this.pc;
    const opCode = this.memory[pc];
    switch (opCode) {
      case 0xc4:
        if (!this.isZFlagSet()) this.stepOutStack.push((pc + 3) & 0xffff);
        break;
      case 0xcc:
        if (this.isZFlagSet()) this.stepOutStack.push((pc + 3) & 0xffff);
        break;
      case 0xcd:
        this.stepOutStack.push((pc + 3) & 0xffff);
        break;
      case 0xd4:
        if (!this.isCFlagSet()) this.stepOutStack.push((pc + 3) & 0xffff);
        break;
      case 0xdc:
        if (this.isCFlagSet()) this.stepOutStack.push((pc + 3) & 0xffff);
        break;
      case 0xe4:
        if (!this.isPvFlagSet()) this.stepOutStack.push((pc + 3) & 0xffff);
        break;
      case 0xec:
        if (this.isPvFlagSet()) this.stepOutStack.push((pc + 3) & 0xffff);
        break;
      case 0xf4:
        if (!this.isSFlagSet()) this.stepOutStack.push((pc + 3) & 0xffff);
        break;
      case 0xfc:
        if (this.isSFlagSet()) this.stepOutStack.push((pc + 3) & 0xffff);
        break;
      case 0xc7:
      case 0xcf:
      case 0xd7:
      case 0xdf:
      case 0xe7:
      case 0xef:
      case 0xf7:
      case 0xff:
        this.stepOutStack.push((pc + 1) & 0xffff);
        break;
    }
  }

  private flushPortOutput(): void {
    if (this.wasm.z80GetLastPortIsWrite() === 0) {
      return;
    }
    this.doWritePort(this.wasm.z80GetLastPortAddress(), this.wasm.z80GetLastPortValue());
  }

  protected flushTbBlueOutput(): void {}

  get a(): number {
    return this.af >> 8;
  }
  set a(value: number) {
    this.af = ((value & 0xff) << 8) | this.f;
  }

  get f(): number {
    return this.af & 0xff;
  }
  set f(value: number) {
    this.af = (this.a << 8) | (value & 0xff);
  }

  get af(): number {
    return this.wasm.z80GetAf();
  }
  set af(value: number) {
    this.wasm.z80SetAf(value);
  }

  get b(): number {
    return this.bc >> 8;
  }
  set b(value: number) {
    this.bc = ((value & 0xff) << 8) | this.c;
  }

  get c(): number {
    return this.bc & 0xff;
  }
  set c(value: number) {
    this.bc = (this.b << 8) | (value & 0xff);
  }

  get bc(): number {
    return this.wasm.z80GetBc();
  }
  set bc(value: number) {
    this.wasm.z80SetBc(value);
  }

  get d(): number {
    return this.de >> 8;
  }
  set d(value: number) {
    this.de = ((value & 0xff) << 8) | this.e;
  }

  get e(): number {
    return this.de & 0xff;
  }
  set e(value: number) {
    this.de = (this.d << 8) | (value & 0xff);
  }

  get de(): number {
    return this.wasm.z80GetDe();
  }
  set de(value: number) {
    this.wasm.z80SetDe(value);
  }

  get h(): number {
    return this.hl >> 8;
  }
  set h(value: number) {
    this.hl = ((value & 0xff) << 8) | this.l;
  }

  get l(): number {
    return this.hl & 0xff;
  }
  set l(value: number) {
    this.hl = (this.h << 8) | (value & 0xff);
  }

  get hl(): number {
    return this.wasm.z80GetHl();
  }
  set hl(value: number) {
    this.wasm.z80SetHl(value);
  }

  get af_(): number {
    return this.wasm.z80GetAfAlt();
  }
  set af_(value: number) {
    this.wasm.z80SetAfAlt(value);
  }

  get bc_(): number {
    return this.wasm.z80GetBcAlt();
  }
  set bc_(value: number) {
    this.wasm.z80SetBcAlt(value);
  }

  get de_(): number {
    return this.wasm.z80GetDeAlt();
  }
  set de_(value: number) {
    this.wasm.z80SetDeAlt(value);
  }

  get hl_(): number {
    return this.wasm.z80GetHlAlt();
  }
  set hl_(value: number) {
    this.wasm.z80SetHlAlt(value);
  }

  get ix(): number {
    return this.wasm.z80GetIx();
  }
  set ix(value: number) {
    this.wasm.z80SetIx(value);
  }

  get xh(): number {
    return this.ix >> 8;
  }
  set xh(value: number) {
    this.ix = ((value & 0xff) << 8) | this.xl;
  }

  get xl(): number {
    return this.ix & 0xff;
  }
  set xl(value: number) {
    this.ix = (this.xh << 8) | (value & 0xff);
  }

  get iy(): number {
    return this.wasm.z80GetIy();
  }
  set iy(value: number) {
    this.wasm.z80SetIy(value);
  }

  get yh(): number {
    return this.iy >> 8;
  }
  set yh(value: number) {
    this.iy = ((value & 0xff) << 8) | this.yl;
  }

  get yl(): number {
    return this.iy & 0xff;
  }
  set yl(value: number) {
    this.iy = (this.yh << 8) | (value & 0xff);
  }

  get ir(): number {
    return this.wasm.z80GetIr();
  }
  set ir(value: number) {
    this.wasm.z80SetIr(value);
  }

  get i(): number {
    return this.ir >> 8;
  }
  set i(value: number) {
    this.ir = ((value & 0xff) << 8) | this.r;
  }

  get r(): number {
    return this.ir & 0xff;
  }
  set r(value: number) {
    this.ir = (this.i << 8) | (value & 0xff);
  }

  get wz(): number {
    return this.wasm.z80GetWz();
  }
  set wz(value: number) {
    this.wasm.z80SetWz(value);
  }

  get wh(): number {
    return this.wz >> 8;
  }

  get wl(): number {
    return this.wz & 0xff;
  }

  get pc(): number {
    return this.wasm.z80GetPc();
  }
  set pc(value: number) {
    this.wasm.z80SetPc(value);
  }

  get sp(): number {
    return this.wasm.z80GetSp();
  }
  set sp(value: number) {
    this.wasm.z80SetSp(value);
  }

  get tacts(): number {
    return this.wasm.z80GetTacts();
  }
  set tacts(value: number) {
    this.wasm.z80SetTacts(value);
  }

  get prefix(): number {
    return this.wasm.z80GetPrefix();
  }

  get halted(): boolean {
    return this.wasm.z80GetHalted() !== 0;
  }

  get sigINT(): boolean {
    return this.wasm.z80GetSigInt() !== 0;
  }
  set sigINT(value: boolean) {
    this.wasm.z80SetSigInt(value ? 1 : 0);
  }

  get sigNMI(): boolean {
    return this.wasm.z80GetSigNmi() !== 0;
  }
  set sigNMI(value: boolean) {
    this.wasm.z80SetSigNmi(value ? 1 : 0);
  }

  get sigRST(): boolean {
    return this.wasm.z80GetSigRst() !== 0;
  }
  set sigRST(value: boolean) {
    this.wasm.z80SetSigRst(value ? 1 : 0);
  }

  get interruptMode(): number {
    return this.wasm.z80GetInterruptMode();
  }
  set interruptMode(value: number) {
    this.wasm.z80SetInterruptMode(value);
  }

  get iff1(): boolean {
    return this.wasm.z80GetIff1() !== 0;
  }
  set iff1(value: boolean) {
    this.wasm.z80SetIff1(value ? 1 : 0);
  }

  get iff2(): boolean {
    return this.wasm.z80GetIff2() !== 0;
  }
  set iff2(value: boolean) {
    this.wasm.z80SetIff2(value ? 1 : 0);
  }

  get eiBacklog(): number {
    return this.wasm.z80GetEiBacklog();
  }
  set eiBacklog(value: number) {
    this.wasm.z80SetEiBacklog(value);
  }

  get retExecuted(): boolean {
    return this.wasm.z80GetRetExecuted() !== 0;
  }
  set retExecuted(value: boolean) {
    this.wasm.z80SetRetExecuted(value ? 1 : 0);
  }

  get retnExecuted(): boolean {
    return this.wasm.z80GetRetnExecuted() !== 0;
  }
  set retnExecuted(value: boolean) {
    this.wasm.z80SetRetnExecuted(value ? 1 : 0);
  }

  tactPlusN(n: number): void {
    this.wasm.z80TactPlusN(n);
  }

  tactPlus1WithAddress(_address: number): void {
    this.tactPlusN(1);
  }

  tactPlus2WithAddress(_address: number): void {
    this.tactPlusN(2);
  }

  tactPlus4WithAddress(_address: number): void {
    this.tactPlusN(4);
  }

  tactPlus5WithAddress(_address: number): void {
    this.tactPlusN(5);
  }

  tactPlus7WithAddress(_address: number): void {
    this.tactPlusN(7);
  }

  isSFlagSet(): boolean {
    return (this.f & FlagsSetMask.S) !== 0;
  }

  isZFlagSet(): boolean {
    return (this.f & FlagsSetMask.Z) !== 0;
  }

  isHFlagSet(): boolean {
    return (this.f & FlagsSetMask.H) !== 0;
  }

  isPvFlagSet(): boolean {
    return (this.f & FlagsSetMask.PV) !== 0;
  }

  isNFlagSet(): boolean {
    return (this.f & FlagsSetMask.N) !== 0;
  }

  isCFlagSet(): boolean {
    return (this.f & FlagsSetMask.C) !== 0;
  }
}

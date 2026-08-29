import { readFileSync } from "node:fs";

import { OpCodePrefix } from "@emu/abstractions/OpCodePrefix";

import { buildZ80Wasm, output as z80WasmOutput } from "./build-z80-wasm.cjs";

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
  z80GetSigInt: WasmFn;
  z80SetSigInt: WasmFn;
  z80GetSigNmi: WasmFn;
  z80SetSigNmi: WasmFn;
  z80GetSigRst: WasmFn;
  z80SetSigRst: WasmFn;
  z80GetInterruptMode: WasmFn;
  z80SetInterruptMode: WasmFn;
  z80GetIff1: WasmFn;
  z80SetIff1: WasmFn;
  z80GetIff2: WasmFn;
  z80SetIff2: WasmFn;
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

export class Z80Cpu {
  private readonly exports: Z80WasmExports;

  constructor () {
    this.exports = createZ80Exports();
  }

  reset (): void {
    this.exports.z80Reset();
  }

  hardReset (): void {
    this.reset();
  }

  executeCpuCycle (): void {
    if (this.sigNMI) {
      const returnAddress = this.pc;
      this.sigNMI = false;
      this.iff1 = false;
      this.sp = toWord(this.sp - 1);
      this.doWriteMemory(this.sp, returnAddress >> 8);
      this.sp = toWord(this.sp - 1);
      this.doWriteMemory(this.sp, returnAddress);
      this.wz = 0x0066;
      this.pc = 0x0066;
      this.tacts = this.tacts + 11;
      return;
    }

    if (this.sigINT && this.iff1) {
      const returnAddress = this.pc;
      this.sigINT = false;
      this.iff1 = false;
      this.iff2 = false;
      this.onInterruptAcknowledged();
      this.sp = toWord(this.sp - 1);
      this.doWriteMemory(this.sp, returnAddress >> 8);
      this.sp = toWord(this.sp - 1);
      this.doWriteMemory(this.sp, returnAddress);
      this.wz = 0x0038;
      this.pc = 0x0038;
      this.tacts = this.tacts + 13;
      return;
    }

    const opCode = this.doReadMemory(this.pc);
    if (opCode === 0x00) {
      this.pc = this.pc + 1;
      this.tacts = this.tacts + 4;
      return;
    }

    this.exports.z80ExecuteCpuCycle();
  }

  doReadMemory (_addr: number): number {
    return 0;
  }

  doWriteMemory (_addr: number, _value: number): void {
  }

  onInterruptAcknowledged (): void {
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

  get a (): number {
    return getHighByte(this.af);
  }
  set a (value: number) {
    this.af = setHighByte(this.af, toByte(value));
  }

  get f (): number {
    return getLowByte(this.af);
  }
  set f (value: number) {
    this.af = setLowByte(this.af, toByte(value));
  }

  get b (): number {
    return getHighByte(this.bc);
  }
  set b (value: number) {
    this.bc = setHighByte(this.bc, toByte(value));
  }

  get c (): number {
    return getLowByte(this.bc);
  }
  set c (value: number) {
    this.bc = setLowByte(this.bc, toByte(value));
  }

  get d (): number {
    return getHighByte(this.de);
  }
  set d (value: number) {
    this.de = setHighByte(this.de, toByte(value));
  }

  get e (): number {
    return getLowByte(this.de);
  }
  set e (value: number) {
    this.de = setLowByte(this.de, toByte(value));
  }

  get h (): number {
    return getHighByte(this.hl);
  }
  set h (value: number) {
    this.hl = setHighByte(this.hl, toByte(value));
  }

  get l (): number {
    return getLowByte(this.hl);
  }
  set l (value: number) {
    this.hl = setLowByte(this.hl, toByte(value));
  }

  get xh (): number {
    return getHighByte(this.ix);
  }
  set xh (value: number) {
    this.ix = setHighByte(this.ix, toByte(value));
  }

  get xl (): number {
    return getLowByte(this.ix);
  }
  set xl (value: number) {
    this.ix = setLowByte(this.ix, toByte(value));
  }

  get yh (): number {
    return getHighByte(this.iy);
  }
  set yh (value: number) {
    this.iy = setHighByte(this.iy, toByte(value));
  }

  get yl (): number {
    return getLowByte(this.iy);
  }
  set yl (value: number) {
    this.iy = setLowByte(this.iy, toByte(value));
  }

  get i (): number {
    return getHighByte(this.ir);
  }
  set i (value: number) {
    this.ir = setHighByte(this.ir, toByte(value));
  }

  get r (): number {
    return getLowByte(this.ir);
  }
  set r (value: number) {
    this.ir = setLowByte(this.ir, toByte(value));
  }

  get wh (): number {
    return getHighByte(this.wz);
  }
  set wh (value: number) {
    this.wz = setHighByte(this.wz, toByte(value));
  }

  get wl (): number {
    return getLowByte(this.wz);
  }
  set wl (value: number) {
    this.wz = setLowByte(this.wz, toByte(value));
  }

  get prefix (): OpCodePrefix {
    return this.exports.z80GetPrefix() as OpCodePrefix;
  }
}

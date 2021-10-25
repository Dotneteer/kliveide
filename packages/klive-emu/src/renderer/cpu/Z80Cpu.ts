import { MemoryHelper } from "@ext-core/memory-helpers";
import { CPU_STATE_BUFFER } from "@ext-core/wa-memory-map";
import { CpuApi } from "../../extensions/core/wa-api";
import { ICpu, ICpuState } from "@abstractions/abstract-cpu";
import { REG_AREA_INDEX } from "@ext/cpu-z80/wa-memory-map";

/**
 * Implements the Z80 CPU state abstraction
 */
export class Z80Cpu implements ICpu {
  /**
   * Initializes the CPU instance to work with the WA implementation of Z80
   * @param cpuApi Use this WA API
   */
  constructor(public readonly cpuApi: CpuApi) {}

  /**
   * Retrieves the state of the Z80 CPI
   */
  getCpuState(): Z80CpuState {
    const s = new Z80CpuState();
    this.cpuApi.getCpuState();

    // --- Get register data from the memory
    let mh = new MemoryHelper(this.cpuApi, REG_AREA_INDEX);

    s.af = mh.readUint16(0);
    s.bc = mh.readUint16(2);
    s.de = mh.readUint16(4);
    s.hl = mh.readUint16(6);
    s._af_ = mh.readUint16(8);
    s._bc_ = mh.readUint16(10);
    s._de_ = mh.readUint16(12);
    s._hl_ = mh.readUint16(14);
    s.pc = mh.readUint16(16);
    s.sp = mh.readUint16(18);
    s.i = mh.readByte(20);
    s.r = mh.readByte(21);
    s.ix = mh.readUint16(22);
    s.iy = mh.readUint16(24);
    s.wz = mh.readUint16(26);

    mh = new MemoryHelper(this.cpuApi, CPU_STATE_BUFFER);

    s.tactsInFrame = mh.readUint32(0);
    s.tacts = mh.readUint32(4);
    s.iff1 = mh.readBool(8);
    s.iff2 = mh.readBool(9);
    s.interruptMode = mh.readByte(10);
    s.opCode = mh.readByte(11);
    s.ddfdDepth = mh.readUint32(12);
    s.useIx = mh.readBool(16);
    s.cpuSignalFlags = mh.readUint32(17);
    s.cpuSnoozed = mh.readBool(21);
    s.intBacklog = mh.readUint32(22);
    s.retExecuted = mh.readBool(26);
    s.baseClockFrequency = mh.readUint32(27);
    s.clockMultiplier = mh.readUint32(31);
    s.defaultClockMultiplier = mh.readUint32(35);

    return s;
  }
}

/**
 * Represents the internal state of the Z80CPU
 */
export class Z80CpuState implements ICpuState {
  _af: number;
  _bc: number;
  _de: number;
  _hl: number;

  _af_sec: number;
  _bc_sec: number;
  _de_sec: number;
  _hl_sec: number;

  _i: number;
  _r: number;

  _pc: number;
  _sp: number;

  _ix: number;
  _iy: number;
  _wz: number;

  get a(): number {
    return this._af >> 8;
  }
  set a(v: number) {
    this._af = ((v << 8) | (this._af & 0xff)) & 0xffff;
  }
  get f(): number {
    return this.af & 0xff;
  }
  set f(v: number) {
    this._af = ((this._af & 0xff00) | (v & 0xff)) & 0xffff;
  }
  get af(): number {
    return this._af;
  }
  set af(v: number) {
    this._af = v & 0xffff;
  }

  get b(): number {
    return this._bc >> 8;
  }
  set b(v: number) {
    this._bc = ((v << 8) | (this._bc & 0xff)) & 0xffff;
  }
  get c(): number {
    return this._bc & 0xff;
  }
  set c(v: number) {
    this._bc = ((this._bc & 0xff00) | (v & 0xff)) & 0xffff;
  }
  get bc(): number {
    return this._bc;
  }
  set bc(v: number) {
    this._bc = v & 0xffff;
  }

  get d(): number {
    return this._de >> 8;
  }
  set d(v: number) {
    this._de = ((v << 8) | (this._de & 0xff)) & 0xffff;
  }
  get e(): number {
    return this._de & 0xff;
  }
  set e(v: number) {
    this._de = ((this._de & 0xff00) | (v & 0xff)) & 0xffff;
  }
  get de(): number {
    return this._de;
  }
  set de(v: number) {
    this._de = v & 0xffff;
  }

  get h(): number {
    return this._hl >> 8;
  }
  set h(v: number) {
    this._hl = ((v << 8) | (this._hl & 0xff)) & 0xffff;
  }
  get l(): number {
    return this._hl & 0xff;
  }
  set l(v: number) {
    this._hl = ((this._hl & 0xff00) | (v & 0xff)) & 0xffff;
  }
  get hl(): number {
    return this._hl;
  }
  set hl(v: number) {
    this._hl = v & 0xffff;
  }

  get _af_(): number {
    return this._af_sec;
  }
  set _af_(v: number) {
    this._af_sec = v & 0xffff;
  }
  get _bc_(): number {
    return this._bc_sec;
  }
  set _bc_(v: number) {
    this._bc_sec = v & 0xffff;
  }
  get _de_(): number {
    return this._de_sec & 0xffff;
  }
  set _de_(v: number) {
    this._de_sec = v & 0xffff;
  }
  get _hl_(): number {
    return this._hl_sec & 0xffff;
  }
  set _hl_(v: number) {
    this._hl_sec = v & 0xffff;
  }

  get i(): number {
    return this._i;
  }
  set i(v: number) {
    this._i = v & 0xff;
  }
  get r(): number {
    return this._r;
  }
  set r(v: number) {
    this._r = v & 0xff;
  }

  get pc(): number {
    return this._pc;
  }
  set pc(v: number) {
    this._pc = v & 0xffff;
  }
  get sp(): number {
    return this._sp;
  }
  set sp(v: number) {
    this._sp = v & 0xffff;
  }

  get xh(): number {
    return this._ix >> 8;
  }
  set xh(v: number) {
    this._ix = ((v << 8) | (this._ix & 0xff)) & 0xffff;
  }
  get xl(): number {
    return this._ix & 0xff;
  }
  set xl(v: number) {
    this._ix = ((this._ix & 0xff00) | (v & 0xff)) & 0xffff;
  }
  get ix(): number {
    return this._ix;
  }
  set ix(v: number) {
    this._ix = v & 0xffff;
  }

  get yh(): number {
    return this._iy >> 8;
  }
  set yh(v: number) {
    this._iy = ((v << 8) | (this._iy & 0xff)) & 0xffff;
  }
  get yl(): number {
    return this._iy & 0xff;
  }
  set yl(v: number) {
    this._iy = ((this._iy & 0xff00) | (v & 0xff)) & 0xffff;
  }
  get iy(): number {
    return this._iy;
  }
  set iy(v: number) {
    this._iy = v & 0xffff;
  }

  get wh(): number {
    return this._wz >> 8;
  }
  set wh(v: number) {
    this._wz = ((v << 8) | (this._wz & 0xff)) & 0xffff;
  }
  get wl(): number {
    return this._wz & 0xff;
  }
  set wl(v: number) {
    this._wz = ((this._wz & 0xff00) | (v & 0xff)) & 0xffff;
  }
  get wz(): number {
    return this._wz;
  }
  set wz(v: number) {
    this._wz = v & 0xffff;
  }

  tactsInFrame: number;
  tacts: number;
  iff1: boolean;
  iff2: boolean;
  interruptMode: number;
  opCode: number;
  ddfdDepth: number;
  useIx: boolean;
  cpuSignalFlags: Z80SignalStateFlags;
  cpuSnoozed: boolean;
  intBacklog: number;
  retExecuted: boolean;
  baseClockFrequency: number;
  clockMultiplier: number;
  defaultClockMultiplier: number;
}

/**
 * Represents the Z80 signal states
 */
export enum Z80SignalStateFlags {
  // No signal is set
  None = 0,

  // Indicates if an interrupt signal arrived
  Int = 0x01,

  // Indicates if a Non-Maskable Interrupt signal arrived
  Nmi = 0x02,

  // Indicates if a RESET signal arrived
  Reset = 0x04,

  // Is the CPU in HALTED state?
  Halted = 0x08,

  // Reset mask of INT
  InvInt = 0xff - Int,

  // Reset mask for NMI
  InvNmi = 0xff - Nmi,

  // Reset mask for RESET
  InvReset = 0xff - Reset,

  // Reset mask for HALT
  InvHalted = 0xff - Halted,
}

/**
 * Represents individual masks for individual flags, and group of
 * flags within the F register
 */
export enum FlagsSetMask {
  S = 0x80,
  Z = 0x40,
  R5 = 0x20,
  H = 0x10,
  R3 = 0x08,
  PV = 0x04,
  N = 0x02,
  C = 0x01,
  SZPV = S | Z | PV,
  NH = N | H,
  R3R5 = R3 | R5,
}

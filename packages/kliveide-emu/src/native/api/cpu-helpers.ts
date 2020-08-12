export enum OpPrefixMode {
  // No operation prefix
  None = 0,

  // Extended mode (0xED prefix)
  Extended,

  // Bit operations mode (0xCB prefix)
  Bit
}

export enum OpIndexMode {
  // Indexed address mode is not used</summary>
  None = 0,

  // <summary>Indexed address with IX register</summary>
  IX,

  // <summary>Indexed address with IY register</summary>
  IY
}

export enum Z80StateFlags {
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
  InvHalted = 0xff - Halted
}

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
  R3R5 = R3 | R5
}

/**
 * Represents the internal state of the Z80CPU
 */
export class Z80CpuState {
  private _af: number;
  private _bc: number;
  private _de: number;
  private _hl: number;

  private _af_sec: number;
  private _bc_sec: number;
  private _de_sec: number;
  private _hl_sec: number;

  private _i: number;
  private _r: number;

  private _pc: number;
  private _sp: number;

  private _ix: number;
  private _iy: number;
  private _wz: number;

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
  allowExtendedSet: boolean;
  tacts: number;
  stateFlags: Z80StateFlags;
  useGateArrayContention: boolean;
  iff1: boolean;
  iff2: boolean;
  interruptMode: number;
  isInterruptBlocked: boolean;
  isInOpExecution: boolean;
  prefixMode: OpPrefixMode;
  indexMode: OpIndexMode;
  maskableInterruptModeEntered: boolean;
  opCode: number;
}

/**
 * Represents data in a particular memory operation
 */
export class MemoryOp {
  address: number;
  value: number;
  isWrite: boolean;
}

/**
 * Represents data in a particular I/O operation
 */
export class IoOp {
  address: number;
  value: number;
  isOutput: boolean;
}

/**
 * Represents information for a TBBlue operation
 */
export class TbBlueOp {
  isIndex: boolean;
  data: number;  
}


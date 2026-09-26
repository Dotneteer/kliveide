/**
 * The ZX Spectrum's 5-byte floating-point numbers ("Float") and the 48K ROM calculator's arithmetic,
 * bit for bit, so that the compiler can fold Float constants to exactly the values the program would
 * compute at run time through the ROM (plan §7.4).
 *
 * A Float is five bytes. With a non-zero first byte it is normalised: the first byte is the exponent
 * (excess 128) and the other four are the mantissa, most significant first, with the implied leading
 * 1 replaced by the sign; the value is 0.1mmm... (binary) x 2^(exponent - 128). With a zero first byte
 * it is the ROM's small-integer form: [0, sign (0 or $FF), low, high, 0], the two middle bytes being
 * the two's complement low word of a value in -65535..65535.
 *
 * Addition, subtraction, multiplication, division, negation, comparison and truncation below mirror
 * the ROM's own routines register for register (their ROM addresses are in the comments), because
 * their rounding, their small-integer shortcuts and their overflow tests are only reproduced exactly
 * that way. `test/kbasic/float40/` checks every operation against the ROM running on the 48K core.
 */

/** Five bytes, as the calculator stack holds them. */
export type Float40 = readonly [number, number, number, number, number];

/** The ROM's report "6 Number too big": an arithmetic result outside the Float range. */
export class Float40Overflow extends Error {
  constructor() {
    super("Number too big");
  }
}

/** A comparison the calculator performs, with its calculator literal. */
export type Float40Comparison = "<=" | ">=" | "<>" | ">" | "<" | "=";

const COMPARISON_LITERAL: Record<Float40Comparison, number> = {
  "<=": 0x09,
  ">=": 0x0a,
  "<>": 0x0b,
  ">": 0x0c,
  "<": 0x0d,
  "=": 0x0e
};

// ==================================================================================================
// Public operations

export function add(a: Float40, b: Float40): Float40 {
  return binary(a, b, (z) => z.addition());
}

export function subtract(a: Float40, b: Float40): Float40 {
  return binary(a, b, (z) => z.subtraction());
}

export function multiply(a: Float40, b: Float40): Float40 {
  return binary(a, b, (z) => z.multiply());
}

/** Throws Float40Overflow for a zero divisor, as the ROM does. */
export function divide(a: Float40, b: Float40): Float40 {
  return binary(a, b, (z) => z.division());
}

export function negate(a: Float40): Float40 {
  return unary(a, (z) => z.negate());
}

/** Drops the fraction (towards zero), as the ROM's `truncate` does; small results in integer form. */
export function truncate(a: Float40): Float40 {
  return unary(a, (z) => z.truncate());
}

/** The ROM's comparison of two numbers: the small integer 1 when it holds, 0 when it does not. */
export function compare(a: Float40, op: Float40Comparison, b: Float40): Float40 {
  return binary(a, b, (z) => z.compare(COMPARISON_LITERAL[op]));
}

/** Whether a Float is the ROM's "true": any value with a non-zero byte among the first four. */
export function isTrue(a: Float40): boolean {
  return (a[0] | a[1] | a[2] | a[3]) !== 0;
}

// ==================================================================================================
// Conversions

/** The integer form the ROM gives an integer in -65535..65535, or an exact normalised Float. */
export function fromInteger(n: number): Float40 {
  if (!Number.isInteger(n)) throw new Error(`${n} is not an integer`);
  if (Math.abs(n) <= 0xffff) {
    const z = new Z();
    z.c = n < 0 ? 0xff : 0;
    z.de = Math.abs(n);
    z.hl = 0;
    z.intStore();
    return z.read(0);
  }
  return fromExact(BigInt(n), 1n);
}

/**
 * The Float nearest to a decimal literal (round half to even), in integer form when the value is an
 * integer in -65535..65535. Throws Float40Overflow when it is too big; a value too small for the
 * smallest Float becomes 0.
 */
export function fromDecimal(text: string): Float40 {
  const m = /^\s*([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?\s*$/.exec(text);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) throw new Error(`'${text}' is not a decimal number`);
  const negative = m[1] === "-";
  const digits = (m[2] + (m[3] ?? "")).replace(/^0+(?=\d)/, "");
  const scale = BigInt(m[4] ?? 0) - BigInt((m[3] ?? "").length);
  let num = BigInt(digits || "0");
  let den = 1n;
  if (scale >= 0n) num *= 10n ** scale;
  else den = 10n ** -scale;
  if (num === 0n) return fromInteger(0);
  if (num % den === 0n) {
    num /= den;
    den = 1n;
  }
  if (den === 1n && num <= 0xffffn) return fromInteger(negative ? -Number(num) : Number(num));
  return fromExact(negative ? -num : num, den);
}

/** The Float nearest to the number (round half to even); integers in -65535..65535 in integer form. */
export function fromNumber(x: number): Float40 {
  if (!Number.isFinite(x)) throw new Float40Overflow();
  if (Number.isInteger(x) && Math.abs(x) <= 0xffff) return fromInteger(x);
  // --- A double is a dyadic rational: exact as num / 2^k
  let k = 0n;
  let v = Math.abs(x);
  while (!Number.isInteger(v)) {
    v *= 2;
    k++;
  }
  const num = BigInt(v) * (x < 0 ? -1n : 1n);
  return fromExact(num, 1n << k);
}

/** The exact value of a Float. */
export function toNumber(a: Float40): number {
  if (a[0] === 0) {
    const word = a[2] | (a[3] << 8);
    return a[1] === 0 ? word : word - 0x10000;
  }
  const mantissa = ((a[1] | 0x80) * 0x1000000 + (a[2] << 16) + (a[3] << 8) + a[4]) / 0x100000000;
  return (a[1] & 0x80 ? -1 : 1) * mantissa * 2 ** (a[0] - 128);
}

/** The Float of num / den (den > 0), rounded to 32 mantissa bits, half to even; normalised form. */
function fromExact(num: bigint, den: bigint): Float40 {
  const negative = num < 0n;
  if (negative) num = -num;
  if (num === 0n) return [0, 0, 0, 0, 0];
  // --- Find e with 2^31 <= num / den * 2^(32 - e) < 2^32
  let e = BigInt(num.toString(2).length - den.toString(2).length);
  const scaled = (shift: bigint) => (shift >= 0n ? [num << shift, den] : [num, den << -shift]);
  let [n, d] = scaled(32n - e);
  while (n / d >= 1n << 32n) [n, d] = scaled(32n - ++e);
  while (n / d < 1n << 31n) [n, d] = scaled(32n - --e);
  let mantissa = n / d;
  const rest = n - mantissa * d;
  if (rest * 2n > d || (rest * 2n === d && (mantissa & 1n) === 1n)) mantissa++;
  if (mantissa === 1n << 32n) {
    mantissa >>= 1n;
    e++;
  }
  const exponent = Number(e) + 128;
  if (exponent > 255) throw new Float40Overflow();
  if (exponent < 1) return [0, 0, 0, 0, 0];
  const m = Number(mantissa);
  return [
    exponent,
    ((m >>> 24) & 0x7f) | (negative ? 0x80 : 0),
    (m >>> 16) & 0xff,
    (m >>> 8) & 0xff,
    m & 0xff
  ];
}

// ==================================================================================================
// The calculator, register by register

function binary(a: Float40, b: Float40, op: (z: Z) => void): Float40 {
  const z = new Z();
  z.write(0, a);
  z.write(5, b);
  z.hl = 0;
  z.de = 5;
  op(z);
  return z.read(0);
}

function unary(a: Float40, op: (z: Z) => void): Float40 {
  const z = new Z();
  z.write(0, a);
  z.hl = 0;
  z.de = 5; // STKEND: just past the number
  op(z);
  return z.read(0);
}

/**
 * The Z80 state the calculator routines use: registers, the alternate set, the flags they test
 * (carry, zero, sign), a stack, and ten bytes of calculator stack holding the two operands. The
 * methods named after ROM routines follow the ROM's instructions one for one.
 */
class Z {
  a = 0;
  b = 0;
  c = 0;
  d = 0;
  e = 0;
  h = 0;
  l = 0;
  alt = [0, 0, 0, 0, 0, 0]; // B' C' D' E' H' L'
  cf = false;
  zf = false;
  sf = false;
  readonly mem = new Uint8Array(10);
  private readonly stack: number[] = [];

  // --- Register pairs and memory

  get hl(): number {
    return (this.h << 8) | this.l;
  }
  set hl(v: number) {
    this.h = (v >> 8) & 0xff;
    this.l = v & 0xff;
  }
  get de(): number {
    return (this.d << 8) | this.e;
  }
  set de(v: number) {
    this.d = (v >> 8) & 0xff;
    this.e = v & 0xff;
  }
  get bc(): number {
    return (this.b << 8) | this.c;
  }
  set bc(v: number) {
    this.b = (v >> 8) & 0xff;
    this.c = v & 0xff;
  }

  write(at: number, value: Float40): void {
    for (let i = 0; i < 5; i++) this.mem[at + i] = value[i] & 0xff;
  }
  read(at: number): Float40 {
    const m = this.mem;
    return [m[at], m[at + 1], m[at + 2], m[at + 3], m[at + 4]];
  }
  get m(): number {
    return this.mem[this.hl];
  }
  set m(v: number) {
    this.mem[this.hl] = v & 0xff;
  }

  push(v: number): void {
    this.stack.push(v & 0xffff);
  }
  pop(): number {
    const v = this.stack.pop();
    if (v === undefined) throw new Error("float40: stack underflow");
    return v;
  }

  exx(): void {
    const [b, c, d, e, h, l] = this.alt;
    this.alt = [this.b, this.c, this.d, this.e, this.h, this.l];
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.h = h;
    this.l = l;
  }
  exDeHl(): void {
    const de = this.de;
    this.de = this.hl;
    this.hl = de;
  }
  incHl(): void {
    this.hl = (this.hl + 1) & 0xffff;
  }
  decHl(): void {
    this.hl = (this.hl - 1) & 0xffff;
  }

  // --- 8-bit arithmetic and logic (A)

  private sz(v: number): number {
    v &= 0xff;
    this.zf = v === 0;
    this.sf = (v & 0x80) !== 0;
    return v;
  }
  add(x: number): void {
    const r = this.a + x;
    this.cf = r > 0xff;
    this.a = this.sz(r);
  }
  adc(x: number): void {
    const r = this.a + x + (this.cf ? 1 : 0);
    this.cf = r > 0xff;
    this.a = this.sz(r);
  }
  sub(x: number): void {
    const r = this.a - x;
    this.cf = r < 0;
    this.a = this.sz(r);
  }
  and(x: number): void {
    this.a = this.sz(this.a & x);
    this.cf = false;
  }
  or(x: number): void {
    this.a = this.sz(this.a | x);
    this.cf = false;
  }
  xor(x: number): void {
    this.a = this.sz(this.a ^ x);
    this.cf = false;
  }
  cp(x: number): void {
    const r = this.a - x;
    this.cf = r < 0;
    this.sz(r);
  }
  neg(): void {
    this.cf = this.a !== 0;
    this.a = this.sz(-this.a);
  }
  cpl(): void {
    this.a ^= 0xff;
  }
  ccf(): void {
    this.cf = !this.cf;
  }
  inc(v: number): number {
    return this.sz(v + 1);
  }
  dec(v: number): number {
    return this.sz(v - 1);
  }

  // --- Rotations: the A-only forms touch carry only; the CB forms also set zero and sign

  rla(): void {
    const c = this.cf;
    this.cf = (this.a & 0x80) !== 0;
    this.a = ((this.a << 1) & 0xff) | (c ? 1 : 0);
  }
  rra(): void {
    const c = this.cf;
    this.cf = (this.a & 1) !== 0;
    this.a = (this.a >> 1) | (c ? 0x80 : 0);
  }
  rlca(): void {
    this.cf = (this.a & 0x80) !== 0;
    this.a = ((this.a << 1) & 0xff) | (this.cf ? 1 : 0);
  }
  rrca(): void {
    this.cf = (this.a & 1) !== 0;
    this.a = (this.a >> 1) | (this.cf ? 0x80 : 0);
  }
  rl(v: number): number {
    const c = this.cf;
    this.cf = (v & 0x80) !== 0;
    return this.sz(((v << 1) & 0xff) | (c ? 1 : 0));
  }
  rr(v: number): number {
    const c = this.cf;
    this.cf = (v & 1) !== 0;
    return this.sz((v >> 1) | (c ? 0x80 : 0));
  }
  rrc(v: number): number {
    this.cf = (v & 1) !== 0;
    return this.sz((v >> 1) | (this.cf ? 0x80 : 0));
  }
  sla(v: number): number {
    this.cf = (v & 0x80) !== 0;
    return this.sz(v << 1);
  }
  sra(v: number): number {
    this.cf = (v & 1) !== 0;
    return this.sz((v >> 1) | (v & 0x80));
  }
  srl(v: number): number {
    this.cf = (v & 1) !== 0;
    return this.sz(v >> 1);
  }

  // --- 16-bit arithmetic on HL

  addHl(x: number): void {
    const r = this.hl + x;
    this.cf = r > 0xffff;
    this.hl = r & 0xffff;
  }
  adcHl(x: number): void {
    const r = this.hl + x + (this.cf ? 1 : 0);
    this.cf = r > 0xffff;
    this.hl = r & 0xffff;
    this.zf = (r & 0xffff) === 0;
    this.sf = (r & 0x8000) !== 0;
  }
  sbcHl(x: number): void {
    const r = this.hl - x - (this.cf ? 1 : 0);
    this.cf = r < 0;
    this.hl = r & 0xffff;
    this.zf = (r & 0xffff) === 0;
    this.sf = (r & 0x8000) !== 0;
  }

  // ================================================================================================
  // ROM routines

  /** INT-FETCH ($2D7F): C = sign byte, DE = magnitude of the small integer at HL; HL ends at byte 3. */
  intFetch(): void {
    this.incHl();
    this.c = this.m;
    this.incHl();
    this.a = this.m;
    this.xor(this.c);
    this.sub(this.c);
    this.e = this.a;
    this.incHl();
    this.a = this.m;
    this.adc(this.c);
    this.xor(this.c);
    this.d = this.a;
  }

  /** INT-STORE ($2D8E): stores sign C and magnitude DE at HL in small-integer form. */
  intStore(): void {
    const hl = this.hl;
    this.m = 0;
    this.incHl();
    this.m = this.c;
    this.incHl();
    this.a = this.e;
    this.xor(this.c);
    this.sub(this.c);
    this.m = this.a;
    this.incHl();
    this.a = this.d;
    this.adc(this.c);
    this.xor(this.c);
    this.m = this.a;
    this.incHl();
    this.m = 0;
    this.hl = hl;
  }

  /** RE-ST-TWO ($3293): both operands in normalised form. */
  reStTwo(): void {
    this.restk();
    this.restk();
  }

  /** $3296: swaps HL and DE, then converts the number at HL from integer form (RESTK). */
  restk(): void {
    this.exDeHl();
    this.a = this.m;
    this.and(this.a);
    if (!this.zf) return;
    this.push(this.de);
    this.intFetch();
    this.xor(this.a);
    this.incHl();
    this.m = this.a;
    this.decHl();
    this.m = this.a;
    this.b = 0x91;
    this.a = this.d;
    this.and(this.a);
    if (this.zf) {
      this.or(this.e);
      this.b = this.d;
      if (this.zf) {
        this.restkStore();
        return;
      }
      this.d = this.e;
      this.e = this.b;
      this.b = 0x89;
    }
    this.exDeHl(); // $32B1
    do {
      this.b = this.dec(this.b);
      this.addHl(this.hl);
    } while (!this.cf);
    this.c = this.rrc(this.c);
    this.h = this.rr(this.h);
    this.l = this.rr(this.l);
    this.exDeHl();
    this.restkStore();
  }

  private restkStore(): void {
    // $32BD
    this.decHl();
    this.m = this.e;
    this.decHl();
    this.m = this.d;
    this.decHl();
    this.m = this.b;
    this.de = this.pop();
  }

  /** PREP-ADD ($2F9B): A = exponent; the number at HL becomes a 40-bit two's complement value. */
  prepAdd(): void {
    this.a = this.m;
    this.m = 0;
    this.and(this.a);
    if (this.zf) return;
    this.incHl();
    this.zf = (this.m & 0x80) === 0;
    this.m |= 0x80;
    this.decHl();
    if (this.zf) return;
    this.push(this.bc);
    this.bc = 5;
    this.addHl(this.bc);
    this.b = this.c;
    this.c = this.a;
    this.cf = true;
    do {
      this.decHl();
      this.a = this.m;
      this.cpl();
      this.adc(0);
      this.m = this.a;
      this.b = (this.b - 1) & 0xff;
    } while (this.b !== 0);
    this.a = this.c;
    this.bc = this.pop();
  }

  /** FETCH-TWO ($2FBA): the two mantissas into H'B'C'CB and L'D'E'DE; A goes into byte 1 of HL's. */
  fetchTwo(): void {
    this.push(this.hl);
    const af = this.a;
    this.c = this.m;
    this.incHl();
    this.b = this.m;
    this.m = this.a;
    this.incHl();
    this.a = this.c;
    this.c = this.m;
    this.push(this.bc);
    this.incHl();
    this.c = this.m;
    this.incHl();
    this.b = this.m;
    this.exDeHl();
    this.d = this.a;
    this.e = this.m;
    this.push(this.de);
    this.incHl();
    this.d = this.m;
    this.incHl();
    this.e = this.m;
    this.push(this.de);
    this.exx();
    this.de = this.pop();
    this.hl = this.pop();
    this.bc = this.pop();
    this.exx();
    this.incHl();
    this.d = this.m;
    this.incHl();
    this.e = this.m;
    this.a = af;
    this.hl = this.pop();
  }

  /** SHIFT-FP ($2FDD): shifts L'D'E'DE right A places, rounding through ADD-BACK. */
  shiftFp(): void {
    this.and(this.a);
    if (this.zf) return;
    this.cp(0x21);
    if (this.cf) {
      this.push(this.bc);
      this.b = this.a;
      do {
        this.exx();
        this.l = this.sra(this.l);
        this.d = this.rr(this.d);
        this.e = this.rr(this.e);
        this.exx();
        this.d = this.rr(this.d);
        this.e = this.rr(this.e);
        this.b = (this.b - 1) & 0xff;
      } while (this.b !== 0);
      this.bc = this.pop();
      if (!this.cf) return;
      this.addBack();
      if (!this.zf) return;
    }
    this.exx(); // $2FF9
    this.xor(this.a);
    this.zeroFp();
  }

  /** $2FFB: L' = 0, D' = A, E' = 0, DE = 0 (the alternate set is current on entry). */
  zeroFp(): void {
    this.l = 0;
    this.d = this.a;
    this.e = this.l;
    this.exx();
    this.de = 0;
  }

  /** ADD-BACK ($3004): increments the 32-bit D'E'DE, setting zero when it wraps. */
  addBack(): void {
    this.e = this.inc(this.e);
    if (!this.zf) return;
    this.d = this.inc(this.d);
    if (!this.zf) return;
    this.exx();
    this.e = this.inc(this.e);
    if (this.zf) this.d = this.inc(this.d);
    this.exx();
  }

  /** subtraction ($300F): negates the second operand and adds. */
  subtraction(): void {
    this.exDeHl();
    this.negate();
    this.exDeHl();
    this.addition();
  }

  /** addition ($3014) */
  addition(): void {
    this.a = this.mem[this.de];
    this.or(this.m);
    if (this.zf) {
      this.push(this.de);
      this.incHl();
      this.push(this.hl);
      this.incHl();
      this.e = this.m;
      this.incHl();
      this.d = this.m;
      this.incHl();
      this.incHl();
      this.incHl();
      this.a = this.m;
      this.incHl();
      this.c = this.m;
      this.incHl();
      this.b = this.m;
      this.hl = this.pop();
      this.exDeHl();
      this.addHl(this.bc);
      this.exDeHl();
      this.adc(this.m);
      this.rrca();
      this.adc(0);
      if (this.zf) {
        this.a = this.cf ? 0xff : 0; // sbc a,a
        this.m = this.a;
        this.incHl();
        this.m = this.e;
        this.incHl();
        this.m = this.d;
        this.decHl();
        this.decHl();
        this.decHl();
        this.de = this.pop();
        return;
      }
      this.decHl(); // $303C
      this.de = this.pop();
    }
    this.reStTwo(); // $303E
    this.exx();
    this.push(this.hl);
    this.exx();
    this.push(this.de);
    this.push(this.hl);
    this.prepAdd();
    this.b = this.a;
    this.exDeHl();
    this.prepAdd();
    this.c = this.a;
    this.cp(this.b);
    if (this.cf) {
      this.a = this.b;
      this.b = this.c;
      this.exDeHl();
    }
    const af = this.a; // $3055: push af
    this.sub(this.b);
    this.fetchTwo();
    this.shiftFp();
    this.a = af;
    this.hl = this.pop();
    this.m = this.a;
    this.push(this.hl);
    this.l = this.b;
    this.h = this.c;
    this.addHl(this.de);
    this.exx();
    this.exDeHl();
    this.adcHl(this.bc);
    this.exDeHl();
    this.a = this.h;
    this.adc(this.l);
    this.l = this.a;
    this.rra();
    this.xor(this.l);
    this.exx();
    this.exDeHl();
    this.hl = this.pop();
    this.rra();
    if (this.cf) {
      this.a = 1;
      this.shiftFp();
      this.m = this.inc(this.m);
      if (this.zf) throw new Float40Overflow(); // $309F
    }
    this.exx(); // $307C
    this.a = this.l;
    this.and(0x80);
    this.exx();
    this.incHl();
    this.m = this.a;
    this.decHl();
    if (!this.zf) {
      this.a = this.e;
      this.neg();
      this.ccf();
      this.e = this.a;
      this.a = this.d;
      this.cpl();
      this.adc(0);
      this.d = this.a;
      this.exx();
      this.a = this.e;
      this.cpl();
      this.adc(0);
      this.e = this.a;
      this.a = this.d;
      this.cpl();
      this.adc(0);
      if (this.cf) {
        this.rra();
        this.exx();
        this.m = this.inc(this.m);
        if (this.zf) throw new Float40Overflow(); // $309F
        this.exx();
      }
      this.d = this.a; // $30A3
      this.exx();
    }
    this.xor(this.a); // $30A5
    this.normalise(); // jp $3155
  }

  /** HL = HL * DE ($30A9): carry set on overflow. */
  mulHlDe(): void {
    this.push(this.bc);
    this.b = 16;
    this.a = this.h;
    this.c = this.l;
    this.hl = 0;
    for (;;) {
      this.addHl(this.hl);
      if (this.cf) break;
      this.c = this.rl(this.c);
      this.rla();
      if (this.cf) {
        this.addHl(this.de);
        if (this.cf) break;
      }
      this.b = (this.b - 1) & 0xff;
      if (this.b === 0) break;
    }
    this.bc = this.pop();
  }

  /** PREP-M/D ($30C0): carry for zero; else A ^= sign and the implied bit is restored. */
  prepMd(): void {
    this.testZero();
    if (this.cf) return;
    this.incHl();
    this.xor(this.m);
    this.m |= 0x80;
    this.decHl();
  }

  /** TEST-ZERO ($34E9): carry when the first four bytes at HL are zero; A is kept. */
  testZero(): void {
    const a = this.a;
    const hl = this.hl;
    this.a = this.m;
    this.incHl();
    this.or(this.m);
    this.incHl();
    this.or(this.m);
    this.incHl();
    this.or(this.m);
    this.a = a;
    this.hl = hl;
    if (!this.zf) return;
    this.cf = true;
  }

  /** multiply ($30CA) */
  multiply(): void {
    this.a = this.mem[this.de];
    this.or(this.m);
    if (this.zf) {
      this.push(this.de);
      this.push(this.hl);
      this.push(this.de);
      this.intFetch();
      this.exDeHl();
      const top = this.pop(); // ex (sp),hl
      this.push(this.hl);
      this.hl = top;
      this.b = this.c;
      this.intFetch();
      this.a = this.b;
      this.xor(this.c);
      this.c = this.a;
      this.hl = this.pop();
      this.mulHlDe();
      this.exDeHl();
      this.hl = this.pop();
      if (!this.cf) {
        this.a = this.d;
        this.or(this.e);
        if (this.zf) this.c = this.a;
        this.intStore();
        this.de = this.pop();
        return;
      }
      this.de = this.pop(); // $30EF
    }
    this.reStTwo(); // $30F0
    this.xor(this.a);
    this.prepMd();
    if (this.cf) return;
    this.exx();
    this.push(this.hl);
    this.exx();
    this.push(this.de);
    this.exDeHl();
    this.prepMd();
    this.exDeHl();
    if (this.cf) {
      this.xor(this.a); // jr $315D
      this.normaliseZero();
      return;
    }
    this.push(this.hl);
    this.fetchTwo();
    this.a = this.b;
    this.and(this.a);
    this.sbcHl(this.hl);
    this.exx();
    this.push(this.hl);
    this.sbcHl(this.hl);
    this.exx();
    this.b = 0x21;
    let first = true;
    do {
      if (!first) {
        // $3114
        if (this.cf) {
          this.addHl(this.de);
          this.exx();
          this.adcHl(this.de);
          this.exx();
        }
        this.exx(); // $311B
        this.h = this.rr(this.h);
        this.l = this.rr(this.l);
        this.exx();
        this.h = this.rr(this.h);
        this.l = this.rr(this.l);
      }
      first = false;
      this.exx(); // $3125
      this.b = this.rr(this.b);
      this.c = this.rr(this.c);
      this.exx();
      this.c = this.rr(this.c);
      this.rra();
      this.b = (this.b - 1) & 0xff;
    } while (this.b !== 0);
    this.exDeHl();
    this.exx();
    this.exDeHl();
    this.exx();
    this.bc = this.pop();
    this.hl = this.pop();
    this.a = this.b;
    this.add(this.c);
    if (this.zf) this.and(this.a);
    this.dec313B();
  }

  /** division ($31AF): throws Float40Overflow for a zero divisor. */
  division(): void {
    this.reStTwo();
    this.exDeHl();
    this.xor(this.a);
    this.prepMd();
    if (this.cf) throw new Float40Overflow();
    this.exDeHl();
    this.prepMd();
    if (this.cf) return;
    this.exx();
    this.push(this.hl);
    this.exx();
    this.push(this.de);
    this.push(this.hl);
    this.fetchTwo();
    this.exx();
    this.push(this.hl);
    this.h = this.b;
    this.l = this.c;
    this.exx();
    this.h = this.c;
    this.l = this.b;
    this.xor(this.a);
    this.b = 0xdf;
    const saved: boolean[] = []; // the carries pushed with AF at $31FE
    let at = 0x31e2;
    for (;;) {
      if (at === 0x31d2) {
        this.rla();
        this.c = this.rl(this.c);
        this.exx();
        this.c = this.rl(this.c);
        this.b = this.rl(this.b);
        this.exx();
        this.addHl(this.hl);
        this.exx();
        this.adcHl(this.hl);
        this.exx();
        if (this.cf) {
          // $31F2
          this.and(this.a);
          this.sbcHl(this.de);
          this.exx();
          this.sbcHl(this.de);
          this.exx();
          this.cf = true; // $31F9
          if (this.divStep(saved)) break;
          at = this.sf ? 0x31d2 : 0x31e2;
          continue;
        }
      }
      // $31E2
      this.sbcHl(this.de);
      this.exx();
      this.sbcHl(this.de);
      this.exx();
      if (!this.cf) {
        this.cf = true; // $31F9
      } else {
        this.addHl(this.de);
        this.exx();
        this.adcHl(this.de);
        this.exx();
        this.and(this.a);
      }
      if (this.divStep(saved)) break;
      at = this.sf ? 0x31d2 : 0x31e2;
    }
    this.e = this.a;
    this.d = this.c;
    this.exx();
    this.e = this.c;
    this.d = this.b;
    this.cf = saved.pop()!;
    this.b = this.rr(this.b);
    this.cf = saved.pop()!;
    this.b = this.rr(this.b);
    this.exx();
    this.bc = this.pop();
    this.hl = this.pop();
    this.a = this.b;
    this.sub(this.c);
    this.exponent313D(); // jp $313D: division does not complement the carry first
  }

  /** $31FA: inc b; loop on minus; push AF and loop once more on zero. True when the loop ends. */
  private divStep(saved: boolean[]): boolean {
    this.b = this.inc(this.b);
    if (this.sf) return false;
    saved.push(this.cf);
    return !this.zf;
  }

  /** $313B: dec a; ccf; then $313D. */
  private dec313B(): void {
    this.a = this.dec(this.a);
    this.ccf();
    this.exponent313D();
  }

  /** $313D-$3154: the result's exponent from A and the carry, with the overflow tests. */
  private exponent313D(): void {
    this.rla();
    this.ccf();
    this.rra();
    // --- jp p tests the sign of the dec a / sub c before the rotations, which leave it alone
    if (this.sf) {
      if (!this.cf) throw new Float40Overflow(); // $3143
      this.and(this.a);
    }
    this.a = this.inc(this.a); // $3146
    if (this.zf && !this.cf) {
      this.exx();
      const bit7 = (this.d & 0x80) !== 0;
      this.exx();
      if (bit7) throw new Float40Overflow();
    }
    this.m = this.a; // $3151
    this.exx();
    this.a = this.b;
    this.exx();
    this.normalise();
  }

  /** $3155: normalises D'E'DE (extra bits in A) and stores the result at HL. */
  private normalise(): void {
    if (this.cf) {
      // $3157
      this.a = this.m;
      this.and(this.a);
      this.a = 0x80;
      if (!this.zf) this.xor(this.a);
      this.storeZeroish();
      return;
    }
    this.b = 0x20; // $316C
    for (;;) {
      this.exx();
      const bit7 = (this.d & 0x80) !== 0;
      this.exx();
      if (bit7) break;
      this.rlca();
      this.e = this.rl(this.e);
      this.d = this.rl(this.d);
      this.exx();
      this.e = this.rl(this.e);
      this.d = this.rl(this.d);
      this.exx();
      this.m = this.dec(this.m);
      if (this.zf) {
        this.a = 0x80; // $3159, then jr z,$315E with zero set
        this.storeZeroish();
        return;
      }
      this.b = (this.b - 1) & 0xff;
      if (this.b === 0) {
        this.normaliseZero(); // $3184: jr $315D
        return;
      }
    }
    this.rla(); // $3186
    if (this.cf) {
      this.addBack();
      if (this.zf) {
        this.exx();
        this.d = 0x80;
        this.exx();
        this.m = this.inc(this.m);
        if (this.zf) throw new Float40Overflow();
      }
    }
    this.store();
  }

  /** $315D: xor a, then $315E. */
  private normaliseZero(): void {
    this.xor(this.a);
    this.storeZeroish();
  }

  /** $315E: a result too small for the exponent: 0, or the smallest number the carry allows. */
  private storeZeroish(): void {
    this.exx();
    this.and(this.d);
    this.zeroFp();
    this.rlca();
    this.m = this.a;
    if (!this.cf) {
      this.incHl();
      this.m = this.a;
      this.decHl();
    }
    this.store();
  }

  /** $3195: stores the sign (bit 7 of byte 1) and D'E'DE at HL, then restores what was pushed. */
  private store(): void {
    this.push(this.hl);
    this.incHl();
    this.exx();
    this.push(this.de);
    this.exx();
    this.bc = this.pop();
    this.a = this.b;
    this.rla();
    this.m = this.rl(this.m);
    this.rra();
    this.m = this.a;
    this.incHl();
    this.m = this.c;
    this.incHl();
    this.m = this.d;
    this.incHl();
    this.m = this.e;
    this.hl = this.pop();
    this.de = this.pop();
    this.exx();
    this.hl = this.pop();
    this.exx();
  }

  /** negate ($346E) */
  negate(): void {
    this.testZero();
    if (this.cf) return;
    this.b = 0;
    this.a = this.m;
    this.and(this.a);
    if (!this.zf) {
      this.incHl();
      this.a = this.b;
      this.and(0x80);
      this.or(this.m);
      this.rla();
      this.ccf();
      this.rra();
      this.m = this.a;
      this.decHl();
      return;
    }
    this.push(this.de); // $3483
    this.push(this.hl);
    this.intFetch();
    this.hl = this.pop();
    this.a = this.b;
    this.or(this.c);
    this.cpl();
    this.c = this.a;
    this.intStore();
    this.de = this.pop();
  }

  /** The numeric comparisons ($353B) for calculator literals $09-$0E: 1 or 0 at HL. */
  compare(literal: number): void {
    this.a = literal - 8;
    if ((this.a & 4) === 0) this.a = this.dec(this.a);
    this.rrca();
    if (this.cf) {
      // EXCHANGE ($343C) the operands
      const first = this.read(this.hl);
      this.write(this.hl, this.read(this.de));
      this.write(this.de, first);
    }
    this.rrca();
    const af = { a: this.a, cf: this.cf };
    this.subtraction();
    if (af.cf) this.not();
    else this.greaterZero();
    this.a = af.a;
    this.rrca();
    if (!this.cf) this.not();
  }

  /** not ($3501): 1 when the number at HL is zero, else 0. */
  private not(): void {
    this.testZero();
    this.storeBoolean();
  }

  /** greater-0 ($34F9): 1 when the number at HL is above zero, else 0; zero is left as it is. */
  private greaterZero(): void {
    this.testZero();
    if (this.cf) return;
    this.a = 0xff;
    this.xor(this.mem[this.hl + 1]);
    this.rlca();
    this.storeBoolean();
  }

  /** $350B: the small integer 0 or 1 (from the carry) at HL. */
  private storeBoolean(): void {
    const hl = this.hl;
    const c = this.cf ? 1 : 0;
    this.mem[hl] = 0;
    this.mem[hl + 1] = 0;
    this.mem[hl + 2] = c;
    this.mem[hl + 3] = 0;
    this.mem[hl + 4] = 0;
  }

  /** truncate ($3214) */
  truncate(): void {
    this.a = this.m;
    this.and(this.a);
    if (this.zf) return;
    this.cp(0x81);
    if (this.cf) {
      this.m = 0;
      this.a = 0x20;
      this.clearBits();
      return;
    }
    this.cp(0x91);
    if (this.zf) {
      this.incHl();
      this.incHl();
      this.incHl();
      this.a = 0x80;
      this.and(this.m);
      this.decHl();
      this.or(this.m);
      this.decHl();
      if (this.zf) {
        this.a = 0x80;
        this.xor(this.m);
      }
      this.decHl(); // $3233
      if (!this.zf) {
        this.a = this.m; // $326C
        this.truncateLarge();
        return;
      }
      this.m = this.a;
      this.incHl();
      this.m = 0xff;
      this.decHl();
      this.a = 0x18;
      this.clearBits();
      return;
    }
    if (!this.cf) {
      this.truncateLarge(); // $326D
      return;
    }
    this.push(this.de); // $3241
    this.cpl();
    this.add(0x91);
    this.incHl();
    this.d = this.m;
    this.incHl();
    this.e = this.m;
    this.decHl();
    this.decHl();
    this.c = 0;
    if (this.d & 0x80) this.c = 0xff;
    this.d |= 0x80;
    this.b = 8;
    this.sub(this.b);
    this.add(this.b);
    if (!this.cf) {
      this.e = this.d;
      this.d = 0;
      this.sub(this.b);
    }
    if (!this.zf) {
      // $325E
      this.b = this.a;
      do {
        this.d = this.srl(this.d);
        this.e = this.rr(this.e);
        this.b = (this.b - 1) & 0xff;
      } while (this.b !== 0);
    }
    this.intStore(); // $3267
    this.de = this.pop();
  }

  /** $326D: sub $A0; ret p; neg; then clear that many low bits. */
  private truncateLarge(): void {
    this.sub(0xa0);
    if (!this.sf) return;
    this.neg();
    this.clearBits();
  }

  /** $3272: clears the A lowest bits of the number that ends just before DE. */
  private clearBits(): void {
    this.push(this.de);
    this.exDeHl();
    this.decHl();
    this.b = this.a;
    this.b = this.srl(this.b);
    this.b = this.srl(this.b);
    this.b = this.srl(this.b);
    if (!this.zf) {
      do {
        this.m = 0;
        this.decHl();
        this.b = (this.b - 1) & 0xff;
      } while (this.b !== 0);
    }
    this.and(7);
    if (!this.zf) {
      this.b = this.a;
      this.a = 0xff;
      do {
        this.a = this.sla(this.a);
        this.b = (this.b - 1) & 0xff;
      } while (this.b !== 0);
      this.and(this.m);
      this.m = this.a;
    }
    this.exDeHl();
    this.de = this.pop();
  }
}

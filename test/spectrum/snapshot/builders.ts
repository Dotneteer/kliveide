/*
 * Test builders: write `.sna`, `.z80` and `.szx` bytes for a machine state, from the format specs
 * (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` D8). No snapshot file is committed; every test makes its own.
 *
 * Writers of real files differ in details the specs leave open; these builders write the plainest
 * spec-conforming file and take options for the variants the tests need.
 */

import { zlibSync } from "fflate";
import { compressZ80DataBlock } from "@common/spectrum/snapshot/z80Compression";

export const BANK = 0x4000;

/** The machine state a builder writes */
export type TestState = {
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  ix: number;
  iy: number;
  sp: number;
  pc: number;
  i: number;
  r: number;
  im: number;
  iff1: boolean;
  iff2: boolean;
  border: number;
  /** 128K numbering: 5/2/0 for a 48K */
  ram: Map<number, Uint8Array>;
  port7ffd?: number;
  port1ffd?: number;
  ay?: { selected: number; regs: number[] };
  frameTact?: number;
  halted?: boolean;
  suppressInterrupt?: boolean;
  memptr?: number;
};

/** A bank filled with a recognisable pattern: `seed`, then the address's low byte */
export function patternBank(seed: number): Uint8Array {
  const b = new Uint8Array(BANK);
  for (let i = 0; i < BANK; i++) b[i] = (i & 0xff) ^ seed;
  // --- A run long enough to be compressed, and a pair of EDs, to exercise the RLE
  b.fill(seed, 0x100, 0x180);
  b[0x200] = 0xed;
  b[0x201] = 0xed;
  b[0x300] = 0xed;
  return b;
}

/** A 48K state with distinct register values */
export function state48(over: Partial<TestState> = {}): TestState {
  const ram = new Map<number, Uint8Array>([
    [5, patternBank(0x55)],
    [2, patternBank(0x22)],
    [0, patternBank(0x00)]
  ]);
  return {
    af: 0x1234,
    bc: 0x2345,
    de: 0x3456,
    hl: 0x4567,
    af_: 0x5678,
    bc_: 0x6789,
    de_: 0x789a,
    hl_: 0x89ab,
    ix: 0x9abc,
    iy: 0x5c3a,
    sp: 0xff40,
    pc: 0x8123,
    i: 0x3f,
    r: 0xa5,
    im: 1,
    iff1: true,
    iff2: true,
    border: 3,
    ram,
    ...over
  };
}

/** A 128K state: banks 0-7 with distinct patterns */
export function state128(over: Partial<TestState> = {}): TestState {
  const ram = new Map<number, Uint8Array>();
  for (let b = 0; b < 8; b++) ram.set(b, patternBank(0x10 * b + 1));
  return state48({
    ram,
    port7ffd: 0x13,
    ay: { selected: 7, regs: [1, 2, 3, 4, 5, 6, 7, 0x38, 9, 10, 11, 12, 13, 14, 0, 0] },
    ...over
  });
}

function word(out: number[], value: number) {
  out.push(value & 0xff, (value >> 8) & 0xff);
}
function dword(out: number[], value: number) {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff);
}

/** The 27-byte `.sna` header */
function snaHeader(s: TestState, sp: number): number[] {
  const h: number[] = [s.i];
  word(h, s.hl_);
  word(h, s.de_);
  word(h, s.bc_);
  word(h, s.af_);
  word(h, s.hl);
  word(h, s.de);
  word(h, s.bc);
  word(h, s.iy);
  word(h, s.ix);
  h.push(s.iff2 ? 0x04 : 0x00, s.r);
  word(h, s.af);
  word(h, sp);
  h.push(s.im, s.border);
  return h;
}

/** A 48K `.sna`: PC is pushed onto the stack */
export function buildSna48(s: TestState): Uint8Array {
  const sp = (s.sp - 2) & 0xffff;
  const ram = new Uint8Array(3 * BANK);
  ram.set(s.ram.get(5)!, 0);
  ram.set(s.ram.get(2)!, BANK);
  ram.set(s.ram.get(0)!, 2 * BANK);
  ram[sp - 0x4000] = s.pc & 0xff;
  ram[sp - 0x4000 + 1] = s.pc >> 8;
  return new Uint8Array([...snaHeader(s, sp), ...ram]);
}

/** A 128K `.sna` */
export function buildSna128(s: TestState, trdos = 0): Uint8Array {
  const paged = s.port7ffd! & 0x07;
  const out: number[] = snaHeader(s, s.sp);
  const push = (bank: number) => {
    for (const b of s.ram.get(bank)!) out.push(b);
  };
  push(5);
  push(2);
  push(paged);
  word(out, s.pc);
  out.push(s.port7ffd!, trdos);
  for (let b = 0; b < 8; b++) {
    if (b === 5 || b === 2) continue;
    if (b === paged && paged !== 5 && paged !== 2) continue;
    push(b);
  }
  return new Uint8Array(out);
}

export type Z80Options = {
  version: 1 | 2 | 3;
  compressed?: boolean;
  /** The hardware-mode byte (default: 48K = 0; 128K = 3 in v2, 4 in v3) */
  hwMode?: number;
  /** Byte 37 bit 7 */
  modified?: boolean;
  /** Write the 55-byte v3 header (with $1FFD) */
  long?: boolean;
  /** Byte 37 bit 2: AY in use on a 48K */
  ay48?: boolean;
  /** 128K machine */
  paged?: boolean;
  issue2?: boolean;
  /** Byte 12 written as $FF (must be read as 1) */
  flags255?: boolean;
};

/** A `.z80` file */
export function buildZ80(s: TestState, o: Z80Options): Uint8Array {
  const h: number[] = [s.af >> 8, s.af & 0xff];
  word(h, s.bc);
  word(h, s.hl);
  word(h, o.version === 1 ? s.pc : 0);
  word(h, s.sp);
  h.push(s.i, s.r & 0x7f);
  const flags1 = o.flags255
    ? 0xff
    : ((s.r >> 7) & 0x01) | ((s.border & 0x07) << 1) | (o.version === 1 && o.compressed ? 0x20 : 0);
  h.push(flags1);
  word(h, s.de);
  word(h, s.bc_);
  word(h, s.de_);
  word(h, s.hl_);
  h.push(s.af_ >> 8, s.af_ & 0xff);
  word(h, s.iy);
  word(h, s.ix);
  h.push(s.iff1 ? 1 : 0, s.iff2 ? 1 : 0, (s.im & 0x03) | (o.issue2 ? 0x04 : 0) | (1 << 6));

  if (o.version === 1) {
    const ram = new Uint8Array(3 * BANK);
    ram.set(s.ram.get(5)!, 0);
    ram.set(s.ram.get(2)!, BANK);
    ram.set(s.ram.get(0)!, 2 * BANK);
    const data = o.compressed ? compressZ80DataBlock(ram, true) : ram;
    return new Uint8Array([...h, ...data]);
  }

  const extraLength = o.version === 2 ? 23 : o.long ? 55 : 54;
  word(h, extraLength);
  word(h, s.pc);
  const hwMode = o.hwMode ?? (o.paged ? (o.version === 2 ? 3 : 4) : 0);
  h.push(hwMode, s.port7ffd ?? 0, 0);
  h.push((o.modified ? 0x80 : 0) | (o.ay48 ? 0x04 : 0) | 0x03);
  h.push(s.ay?.selected ?? 0);
  for (let i = 0; i < 16; i++) h.push(s.ay?.regs[i] ?? 0);
  if (o.version === 3) {
    // --- T-states: the high counter is 3 just after the interrupt; the low one counts down
    const quarter = o.paged ? 17727 : 17472;
    const tact = s.frameTact ?? 0;
    const q = Math.floor(tact / quarter);
    const low = quarter - 1 - (tact % quarter);
    word(h, low);
    h.push((q + 3) & 0x03);
    h.push(0, 0, 0, 0, 0);
    for (let i = 0; i < 20; i++) h.push(0);
    h.push(0, 0, 0);
    if (o.long) h.push(s.port1ffd ?? 0);
  }
  const out = [...h];
  const pages = o.paged
    ? [...s.ram.keys()].map((b) => ({ page: b + 3, bank: b }))
    : [
        { page: 8, bank: 5 },
        { page: 4, bank: 2 },
        { page: 5, bank: 0 }
      ].filter((p) => s.ram.has(p.bank));
  for (const { page, bank } of pages) {
    const data = s.ram.get(bank)!;
    if (o.compressed === false) {
      word(out, 0xffff);
      out.push(page);
      for (const b of data) out.push(b);
    } else {
      const c = compressZ80DataBlock(data);
      word(out, c.length);
      out.push(page);
      for (const b of c) out.push(b);
    }
  }
  return new Uint8Array(out);
}

/** A block of a `.szx` file */
export function szxBlock(id: string, data: number[] | Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < 4; i++) out.push(i < id.length ? id.charCodeAt(i) : 0);
  dword(out, data.length);
  for (const b of data) out.push(b);
  return out;
}

export type SzxOptions = {
  machineId: number;
  minor?: number;
  compressed?: boolean;
  flags?: number;
  /** Extra blocks, appended after the RAM pages */
  extra?: number[][];
  /** Leave out these blocks */
  omit?: string[];
};

/** A `.szx` file */
export function buildSzx(s: TestState, o: SzxOptions): Uint8Array {
  const out: number[] = [0x5a, 0x58, 0x53, 0x54, 1, o.minor ?? 4, o.machineId, o.flags ?? 0];
  const omit = new Set(o.omit ?? []);
  const crtr: number[] = [];
  const name = "Klive test builder";
  for (let i = 0; i < 32; i++) crtr.push(i < name.length ? name.charCodeAt(i) : 0);
  word(crtr, 1);
  word(crtr, 2);
  if (!omit.has("CRTR")) out.push(...szxBlock("CRTR", crtr));

  const z: number[] = [];
  for (const v of [s.af, s.bc, s.de, s.hl, s.af_, s.bc_, s.de_, s.hl_, s.ix, s.iy, s.sp, s.pc]) {
    word(z, v);
  }
  z.push(s.i, s.r, s.iff1 ? 1 : 0, s.iff2 ? 1 : 0, s.im);
  dword(z, s.frameTact ?? 0);
  z.push(0, (s.suppressInterrupt ? 0x01 : 0) | (s.halted ? 0x02 : 0));
  word(z, s.memptr ?? 0);
  if (!omit.has("Z80R")) out.push(...szxBlock("Z80R", z));

  if (!omit.has("SPCR")) {
    out.push(...szxBlock("SPCR", [s.border, s.port7ffd ?? 0, s.port1ffd ?? 0, 0x18, 0, 0, 0, 0]));
  }
  for (const [page, data] of s.ram) {
    if (omit.has(`RAMP${page}`)) continue;
    const payload = o.compressed === false ? data : zlibSync(data);
    out.push(...szxBlock("RAMP", [o.compressed === false ? 0 : 1, 0, page, ...payload]));
  }
  if (s.ay) {
    out.push(...szxBlock("AY", [0, s.ay.selected, ...s.ay.regs]));
  }
  for (const e of o.extra ?? []) out.push(...e);
  return new Uint8Array(out);
}

/** A `.szx` TAPE block with an embedded (optionally compressed) tape */
export function szxTapeBlock(tape: Uint8Array, ext: string, compressed: boolean, block = 0): number[] {
  const payload = compressed ? zlibSync(tape) : tape;
  const d: number[] = [];
  word(d, block);
  word(d, 0x01 | (compressed ? 0x02 : 0));
  dword(d, tape.length);
  dword(d, payload.length);
  for (let i = 0; i < 16; i++) d.push(i < ext.length ? ext.charCodeAt(i) : 0);
  for (const b of payload) d.push(b);
  return szxBlock("TAPE", d);
}

/** A `.szx` DSK block linking a disk file */
export function szxDskBlock(drive: number, fileName: string): number[] {
  const d: number[] = [];
  word(d, 0);
  d.push(drive);
  dword(d, fileName.length + 1);
  for (const c of fileName) d.push(c.charCodeAt(0));
  d.push(0);
  return szxBlock("DSK", d);
}

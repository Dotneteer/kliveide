import { HISTORY_RECORD_SIZE, type ExecutionHistoryPage } from "./historyTypes";

/*
 * Decodes the 64-byte execution-history record (`src/emu/z80/wasm/z80-history.c`,
 * `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.2). Pure: no React, no Node.
 */

/** The record kinds; the numbers are `Z80_HISTORY_KIND_*` in `z80.c` */
export const HistoryKind = {
  Instruction: 0,
  Int: 1,
  Nmi: 2,
  Halt: 3,
  ForcedNop: 4,
  DmaHold: 5
} as const;
export type HistoryKind = (typeof HistoryKind)[keyof typeof HistoryKind];

/**
 * The CPU state before the record's event (D3), in `Z80CpuState`'s register names so the detail pane
 * and G4.3 can put a record where a live state goes
 */
export type HistoryRegisters = {
  pc: number;
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
  /** I in the high byte, R in the low one */
  ir: number;
  wz: number;
  iff1: boolean;
  iff2: boolean;
  interruptMode: number;
};

export type HistoryRecord = {
  /** The record's sequence number: the full value when decoded from a page, else the low 32 bits */
  sequence: number;
  frame: number;
  /** The position in the frame, in the machine's unit (the Next: 28 MHz ticks) */
  frameTact: number;
  kind: HistoryKind;
  /** HALT: cycles; DMA hold: T-states held; otherwise 1 */
  repeat: number;
  /** INT was pending when the record was made */
  intPending: boolean;
  /** The core could not read every byte after the opcode (its peek crossed an unreadable region) */
  bytesTruncated: boolean;
  regs: HistoryRegisters;
  /** The 4 bytes at PC as the CPU decoded them (T3); INT: byte 0 is the IM 2 vector */
  bytes: number[];
  /** The machine context (16 bytes), for the machine's decoder (`contexts/`) */
  context: Uint8Array;
};

/**
 * Decodes one record
 * @param data The bytes
 * @param offset Where the record starts
 * @param sequence The full sequence number, when the caller knows it
 */
export function decodeHistoryRecord(data: Uint8Array, offset = 0, sequence?: number): HistoryRecord {
  const v = new DataView(data.buffer, data.byteOffset + offset, HISTORY_RECORD_SIZE);
  const w = (o: number) => v.getUint16(o, true);
  const flags = v.getUint8(13);
  return {
    sequence: sequence ?? v.getUint32(0, true),
    frame: v.getUint32(4, true),
    frameTact: v.getUint32(8, true),
    kind: v.getUint8(12) as HistoryKind,
    repeat: w(14),
    intPending: (flags & 0x10) !== 0,
    bytesTruncated: (flags & 0x20) !== 0,
    regs: {
      pc: w(16),
      af: w(18),
      bc: w(20),
      de: w(22),
      hl: w(24),
      af_: w(26),
      bc_: w(28),
      de_: w(30),
      hl_: w(32),
      ix: w(34),
      iy: w(36),
      sp: w(38),
      ir: (v.getUint8(40) << 8) | v.getUint8(41),
      wz: w(42),
      iff1: (flags & 0x01) !== 0,
      iff2: (flags & 0x02) !== 0,
      interruptMode: (flags >> 2) & 0x03
    },
    bytes: [v.getUint8(44), v.getUint8(45), v.getUint8(46), v.getUint8(47)],
    context: data.slice(offset + 48, offset + 64)
  };
}

/** Decodes every record of a page, with full sequence numbers */
export function decodeHistoryPage(page: Pick<ExecutionHistoryPage, "records" | "firstSequence">): HistoryRecord[] {
  const out: HistoryRecord[] = [];
  const n = Math.floor(page.records.length / HISTORY_RECORD_SIZE);
  for (let i = 0; i < n; i++) {
    out.push(decodeHistoryRecord(page.records, i * HISTORY_RECORD_SIZE, page.firstSequence + i));
  }
  return out;
}

/**
 * Encodes a record: the inverse of `decodeHistoryRecord`, for tests and for building fixtures
 * (the core writes the real ones)
 */
export function encodeHistoryRecord(r: HistoryRecord): Uint8Array {
  const data = new Uint8Array(HISTORY_RECORD_SIZE);
  const v = new DataView(data.buffer);
  const w = (o: number, value: number) => v.setUint16(o, value & 0xffff, true);
  v.setUint32(0, r.sequence >>> 0, true);
  v.setUint32(4, r.frame >>> 0, true);
  v.setUint32(8, r.frameTact >>> 0, true);
  v.setUint8(12, r.kind);
  v.setUint8(
    13,
    (r.regs.iff1 ? 0x01 : 0) |
      (r.regs.iff2 ? 0x02 : 0) |
      ((r.regs.interruptMode & 0x03) << 2) |
      (r.intPending ? 0x10 : 0) |
      (r.bytesTruncated ? 0x20 : 0)
  );
  w(14, r.repeat);
  w(16, r.regs.pc);
  w(18, r.regs.af);
  w(20, r.regs.bc);
  w(22, r.regs.de);
  w(24, r.regs.hl);
  w(26, r.regs.af_);
  w(28, r.regs.bc_);
  w(30, r.regs.de_);
  w(32, r.regs.hl_);
  w(34, r.regs.ix);
  w(36, r.regs.iy);
  w(38, r.regs.sp);
  v.setUint8(40, (r.regs.ir >> 8) & 0xff);
  v.setUint8(41, r.regs.ir & 0xff);
  w(42, r.regs.wz);
  r.bytes.slice(0, 4).forEach((b, i) => v.setUint8(44 + i, b & 0xff));
  data.set(r.context.subarray(0, 16), 48);
  return data;
}

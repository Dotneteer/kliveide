/*
 * The DMA Port Log (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §11): the core's ring of accesses to ports
 * $6B and $0B, decoded, and the rows the document shows. Pure: shared by the emulator process (which
 * copies the ring) and the renderer (which builds the rows). Text-free: rows hold kinds, roles and the
 * decoder's command; the document formats them.
 *
 * The record layout is the core's (`zxnext-dma.c` `zxnextDmaLogRecord`).
 */

import { decodeDmaCommand, dmaGroupOf, type DmaCommand, type DmaFieldRole } from "./dmaDecoder";
import { DMA_READ_ENTRIES, DmaWrSeq, type DmaReadEntry } from "./dmaState";

export const NEXT_DMA_LOG_RECORD_SIZE = 16;

const FLAG_READ = 0x01;
const FLAG_PORT_0B = 0x02;
const FLAG_HOST = 0x04;

/** The ring's records as the machine hands them over (`IZxNextIdeMachine.getDmaLog`) */
export type NextDmaLog = {
  enabled: boolean;
  capacity: number;
  /** Records written since the last clear (only ever grows) */
  count: number;
  /** The sequence number of the first record in `records` */
  firstSeq: number;
  records: Uint8Array;
};

/** One access to a DMA port */
export type DmaLogRecord = {
  seq: number;
  frame: number;
  /** Position in the frame, 28 MHz clocks */
  pos28: number;
  /** The instruction's PC (0 for a host access) */
  pc: number;
  value: number;
  read: boolean;
  /** Through port $0B (Z80 DMA mode) rather than $6B */
  port0B: boolean;
  /** Not from a CPU instruction: a test harness or the IDE wrote it */
  host: boolean;
  /** The CPU speed: 0 = 3.5 MHz ... 3 = 28 MHz */
  speed: number;
  /** Write: the write sequencer before and after the byte; read: `before` is the read entry */
  before: number;
  after: number;
  /** Write: the base byte of the group in progress after the byte */
  regTemp: number;
  /** Write: start addresses written since the last $CF, after the byte */
  startsSinceLoad: boolean;
};

/** Decodes the machine's records */
export function decodeDmaLog(log: NextDmaLog): DmaLogRecord[] {
  const out: DmaLogRecord[] = [];
  const b = log.records;
  const n = Math.floor(b.length / NEXT_DMA_LOG_RECORD_SIZE);
  for (let i = 0; i < n; i++) {
    const o = i * NEXT_DMA_LOG_RECORD_SIZE;
    const flags = b[o + 11];
    out.push({
      seq: log.firstSeq + i,
      frame: (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0,
      pos28: (b[o + 4] | (b[o + 5] << 8) | (b[o + 6] << 16) | (b[o + 7] << 24)) >>> 0,
      pc: b[o + 8] | (b[o + 9] << 8),
      value: b[o + 10],
      read: (flags & FLAG_READ) !== 0,
      port0B: (flags & FLAG_PORT_0B) !== 0,
      host: (flags & FLAG_HOST) !== 0,
      speed: (flags >> 4) & 0x03,
      before: b[o + 12],
      after: b[o + 13],
      regTemp: b[o + 14],
      startsSinceLoad: (b[o + 15] & 0x01) !== 0
    });
  }
  return out;
}

/** The T-state in the frame at 3.5 MHz (the frame's own clock) */
export const dmaLogFrameT = (r: Pick<DmaLogRecord, "pos28">) => Math.floor(r.pos28 / 8);

/** The zxnDDMA commands of core 3.03 and what their bytes set */
export const DDMA_COMMANDS: Record<number, string> = {
  0xd7: "port A bits 23-16",
  0xdb: "port B bits 23-16",
  0xdf: "flags",
  0xe3: "row length",
  0xe7: "rows",
  0xeb: "port A stride",
  0xef: "port B stride",
  0xf3: "transparent colour",
  0xf7: "fill value"
};

export type DmaLogAnomaly =
  /** Written while WR4 bit 4 had left the DMA deaf: ignored */
  | "deaf"
  /** This byte left the DMA deaf (WR4 bit 4 without port B's address) */
  | "becomesDeaf"
  /** A base byte that matches no register group: ignored */
  | "ignored"
  /** An enable while start addresses written after the last $CF wait for a load */
  | "enableWithoutLoad"
  /** A zxnDDMA command byte through $0B, where the DMA does not know it */
  | "ddmaOn0B";

export type DmaLogWriteRow = {
  kind: "write";
  record: DmaLogRecord;
  /** A base byte, a follow byte of the command before it, or a byte the DMA ignored */
  role: "base" | "follow" | "ignored";
  /** The register group: "WR0".."WR6", "zxnDDMA", or undefined for an ignored byte */
  group?: string;
  /** Base rows: the command, decoded from its recorded bytes */
  command?: DmaCommand;
  /** zxnDDMA base rows: what the command sets */
  ddma?: string;
  /** Follow rows: the field the byte is part of */
  field?: DmaFieldRole | "ddma";
  anomalies: DmaLogAnomaly[];
};

export type DmaLogReadRow = {
  kind: "read";
  record: DmaLogRecord;
  entry: DmaReadEntry;
  anomalies: DmaLogAnomaly[];
};

export type DmaLogRow = DmaLogWriteRow | DmaLogReadRow;

/** A run of writes ending with an enable, or the writes after the last enable (open) */
export type DmaLogSetup = {
  index: number;
  /** The first write's record (PC, frame, port) */
  first: DmaLogRecord;
  writes: number;
  /** The commands, in order (for "copy as source") */
  commands: DmaCommand[];
  /** It ends with an enable */
  enables: boolean;
  anomalies: number;
};

export type DmaLogEntry = { type: "setup"; setup: DmaLogSetup } | { type: "row"; row: DmaLogRow; setup?: number };

/** The low and high byte of each 16-bit field */
const HALVES: Partial<Record<DmaFieldRole, [DmaFieldRole, DmaFieldRole]>> = {
  portA: ["portALo", "portAHi"],
  length: ["lengthLo", "lengthHi"],
  portB: ["portBLo", "portBHi"]
};

/** Commands about reading the DMA back: they do not start a setup on their own */
const READ_COMMANDS = new Set([0xbf, 0xa7, 0x8b, 0xbb]);
const isReadCommand = (row: DmaLogRow) =>
  row.kind === "write" && row.role !== "ignored" && row.group === "WR6" && READ_COMMANDS.has(row.record.value);

const isEnable = (cmd: DmaCommand | undefined) =>
  !!cmd && ((cmd.kind === "wr6" && cmd.command === 0x87) || (cmd.kind === "wr3" && cmd.dmaEnable));

/**
 * Builds the document's entries from the records: each write is placed in its command by the
 * sequencer states the core recorded (a write with the sequencer idle is a base byte, the writes after
 * it with the sequencer busy are its follow bytes), and the writes are grouped into setups.
 */
export function buildDmaLogEntries(records: readonly DmaLogRecord[]): DmaLogEntry[] {
  const rows: DmaLogRow[] = [];
  // --- The base row of the command in progress and its rows, for decoding when it ends
  let open: { base: DmaLogWriteRow; rows: DmaLogWriteRow[] } | undefined;
  const finish = () => {
    if (!open) return;
    const bytes = open.rows.map((r) => r.record.value);
    if (open.base.group === "zxnDDMA") {
      open.rows.slice(1).forEach((r) => (r.field = "ddma"));
    } else {
      const cmd = decodeDmaCommand(bytes, 0, bytes.length);
      open.base.command = cmd;
      for (const f of cmd.fields) {
        for (let k = 0; k < f.size; k++) {
          const row = open.rows[f.offset + k];
          // --- a 16-bit value's bytes are its low and high byte
          if (row) row.field = f.size === 2 ? HALVES[f.role]?.[k] ?? f.role : f.role;
        }
      }
    }
    open = undefined;
  };

  for (const record of records) {
    if (record.read) {
      rows.push({ kind: "read", record, entry: DMA_READ_ENTRIES[record.before < 7 ? record.before : 0], anomalies: [] });
      continue;
    }
    const anomalies: DmaLogAnomaly[] = [];
    if (record.before === DmaWrSeq.R4Byte2Deaf) {
      finish();
      rows.push({ kind: "write", record, role: "ignored", anomalies: ["deaf"] });
      continue;
    }
    if (record.after === DmaWrSeq.R4Byte2Deaf) anomalies.push("becomesDeaf");
    if (record.before !== DmaWrSeq.Idle && open) {
      const row: DmaLogWriteRow = { kind: "write", record, role: "follow", group: open.base.group, anomalies };
      open.rows.push(row);
      rows.push(row);
      if (record.after === DmaWrSeq.Idle || record.after === DmaWrSeq.R4Byte2Deaf) finish();
      continue;
    }
    // --- A base byte
    finish();
    const isDdma = record.after === DmaWrSeq.Ddma;
    const kind = dmaGroupOf(record.value);
    if (!isDdma && kind === "invalid") {
      rows.push({ kind: "write", record, role: "ignored", anomalies: [...anomalies, "ignored"] });
      continue;
    }
    if (record.port0B && DDMA_COMMANDS[record.value] !== undefined) anomalies.push("ddmaOn0B");
    const base: DmaLogWriteRow = {
      kind: "write",
      record,
      role: "base",
      group: isDdma ? "zxnDDMA" : kind.toUpperCase(),
      ddma: isDdma ? DDMA_COMMANDS[record.value] : undefined,
      anomalies
    };
    rows.push(base);
    open = { base, rows: [base] };
    if (record.after === DmaWrSeq.Idle || record.after === DmaWrSeq.R4Byte2Deaf) finish();
  }
  finish();

  // --- An enable with starts waiting for a load (the core's flag after the byte)
  for (const row of rows) {
    if (row.kind === "write" && row.role === "base" && isEnable(row.command) && row.record.startsSinceLoad) {
      row.anomalies.push("enableWithoutLoad");
    }
  }

  // --- Setups: writes up to and including an enable
  const entries: DmaLogEntry[] = [];
  let setup: DmaLogSetup | undefined;
  let setupIndex = 0;
  let readMaskFollow = false;
  for (const row of rows) {
    // --- A read-back command outside a setup (and $BB's mask byte) stays on its own
    const standalone = !setup && (isReadCommand(row) || (readMaskFollow && row.kind === "write" && row.role === "follow"));
    readMaskFollow = !setup && row.kind === "write" && row.role === "base" && row.record.value === 0xbb;
    if (standalone) {
      entries.push({ type: "row", row });
      continue;
    }
    if (row.kind === "write") {
      if (!setup) {
        setup = { index: ++setupIndex, first: row.record, writes: 0, commands: [], enables: false, anomalies: 0 };
        entries.push({ type: "setup", setup });
      }
      setup.writes++;
      setup.anomalies += row.anomalies.length;
      if (row.role === "base" && row.command) setup.commands.push(row.command);
      entries.push({ type: "row", row, setup: setup.index });
      if (row.role === "base" && isEnable(row.command)) {
        setup.enables = true;
        setup = undefined;
      }
    } else {
      entries.push({ type: "row", row, setup: setup?.index });
    }
  }
  return entries;
}

/*
 * `.dma` programs (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §10): grouping the bytes of `.dma` lines into
 * programs, the build warnings' rules, and the editor's program summary. Pure (no React, no Node), shared
 * by the assembler's post-pass and the Klive assembler editor, so the two always agree.
 *
 * The input is a byte array (a segment's emitted code, or the editor's address-indexed bytes) and the
 * `.dma` lines as `{ key, offset, length }` in ascending offset order: `key` is the caller's handle for
 * the line (an index, a line number). The bytes between two `.dma` lines are data lines (the runtime
 * patching pattern's `.dw` values). Text is the caller's: rules return codes and arguments.
 */

import { decodeDmaStream, dmaGroupName, type DmaCommand } from "./dmaDecoder";

/**
 * A `.dma` program as the assembler exports it (`AssemblerOutput.dmaPrograms`) for the editor: its
 * bytes after the fixups, and where each `.dma` line's bytes are in them
 */
export type DmaProgramRecord = {
  /** The address of the program's first byte */
  address: number;
  bytes: number[];
  lines: { fileIndex: number; line: number; offset: number; length: number }[];
};

/** A file's programs from the assembler's records, regrouped with 1-based line numbers as keys */
export function dmaProgramsOfFile(records: readonly DmaProgramRecord[], fileIndex: number): DmaProgram<number>[] {
  const result: DmaProgram<number>[] = [];
  for (const record of records) {
    const lines = record.lines
      .filter((l) => l.fileIndex === fileIndex)
      .map((l) => ({ key: l.line, offset: l.offset, length: l.length }));
    if (lines.length > 0) result.push(...groupDmaPrograms(record.bytes, lines));
  }
  return result;
}

/** A `.dma` line's bytes: the caller's key, where they start, how many */
export type DmaLine<TKey> = { key: TKey; offset: number; length: number };

/** A `.dma` program: its lines, its byte range and the commands the DMA takes from it */
export type DmaProgram<TKey> = {
  lines: DmaLine<TKey>[];
  start: number;
  end: number;
  commands: DmaCommand[];
};

/** How many follow bytes the last command of `[start, end)` still expects */
function pendingAfter(bytes: ArrayLike<number>, start: number, end: number): number {
  const commands = decodeDmaStream(bytes, start, end);
  return commands.length > 0 ? commands[commands.length - 1].missing : 0;
}

/**
 * Groups `.dma` lines into programs (§10.1): a line joins the program before it when the gap between
 * them is no longer than the follow bytes that program still expects; otherwise it starts a new one.
 * A program's range ends at its last line's end, extended over the follow bytes still expected if the
 * array has them (the `.dw` values after a base-only WR0 or WR4).
 */
export function groupDmaPrograms<TKey>(bytes: ArrayLike<number>, lines: readonly DmaLine<TKey>[]): DmaProgram<TKey>[] {
  const programs: DmaProgram<TKey>[] = [];
  let current: { lines: DmaLine<TKey>[]; start: number; end: number } | undefined;
  const close = () => {
    if (!current) return;
    const pending = pendingAfter(bytes, current.start, current.end);
    const end = Math.min(bytes.length, current.end + pending);
    programs.push({ ...current, end, commands: decodeDmaStream(bytes, current.start, end) });
    current = undefined;
  };
  for (const line of lines) {
    if (line.length <= 0) continue;
    if (current) {
      const gap = line.offset - current.end;
      if (gap >= 0 && gap <= pendingAfter(bytes, current.start, current.end)) {
        current.lines.push(line);
        current.end = line.offset + line.length;
        continue;
      }
      close();
    }
    current = { lines: [line], start: line.offset, end: line.offset + line.length };
  }
  close();
  return programs;
}

/** The `.dma` line whose bytes contain `offset`, or the last one before it (for data bytes) */
export function dmaLineAt<TKey>(program: DmaProgram<TKey>, offset: number): DmaLine<TKey> {
  let found = program.lines[0];
  for (const line of program.lines) {
    if (line.offset <= offset) found = line;
    else break;
  }
  return found;
}

/** The build warnings (§10.2) */
export type DmaWarningCode = "Z0388" | "Z0389" | "Z0390" | "Z0391" | "Z0392";

export type DmaWarning<TKey> = {
  code: DmaWarningCode;
  /** The line the warning is about */
  key: TKey;
  /** Z0388: the earlier line whose group takes the byte */
  ownerKey?: TKey;
  /** The message's arguments, in order */
  args: (string | number)[];
};

const OPERATING_MODE_NAMES = ["byte", "continuous", "burst", "mode 3"];

/** Whether a command enables the DMA: `$87`, or WR3 with D6 */
const isEnable = (c: DmaCommand) => (c.kind === "wr6" && c.command === 0x87) || (c.kind === "wr3" && c.dmaEnable);

/** The build warnings of one program (§10.2) */
export function dmaProgramWarnings<TKey>(program: DmaProgram<TKey>): DmaWarning<TKey>[] {
  const warnings: DmaWarning<TKey>[] = [];
  const at = (offset: number) => dmaLineAt(program, offset).key;
  const { commands } = program;

  // --- Z0388: a `.dma` line whose first byte is not a base byte
  const starts = new Set(commands.map((c) => c.offset));
  for (const line of program.lines) {
    if (starts.has(line.offset)) continue;
    const owner = commands.find((c) => c.offset < line.offset && line.offset < c.offset + c.bytes.length);
    if (!owner) continue;
    const expected = owner.offset + owner.bytes.length + owner.missing - line.offset;
    warnings.push({
      code: "Z0388",
      key: line.key,
      ownerKey: at(owner.offset),
      args: [dmaGroupName(owner.kind), expected]
    });
  }

  // --- Z0389: an enable after new start addresses without a load
  let startsWritten = false;
  for (const c of commands) {
    if ((c.kind === "wr0" && c.portA !== undefined) || (c.kind === "wr4" && c.portB !== undefined)) startsWritten = true;
    if (c.kind === "wr6" && c.command === 0xcf) startsWritten = false;
    if (isEnable(c) && startsWritten) warnings.push({ code: "Z0389", key: at(c.offset), args: [] });
  }

  // --- Z0390, Z0391: the mode of the program's last WR4
  const wr4 = [...commands].reverse().find((c) => c.kind === "wr4");
  if (wr4 && wr4.kind === "wr4") {
    const wr2 = [...commands].reverse().find((c) => c.kind === "wr2");
    const prescaler = wr2 && wr2.kind === "wr2" ? (wr2.prescaler ?? 0) : 0;
    const keepsBus = wr4.mode !== 2 || prescaler === 0;
    const mode = OPERATING_MODE_NAMES[wr4.mode];
    for (const c of commands) {
      if (c.kind === "wr5" && c.autoRestart && keepsBus) {
        warnings.push({ code: "Z0390", key: at(c.offset), args: [wr4.mode === 2 ? "burst (no prescaler)" : mode] });
      }
      if (c.kind === "wr2" && (c.prescaler ?? 0) > 0 && wr4.mode !== 2) {
        warnings.push({ code: "Z0391", key: at(c.offset), args: [mode] });
      }
    }
  }

  // --- Z0392: settings the Next's DMA does not have
  for (const c of commands) {
    const ignored: string[] = [];
    if (c.kind === "wr0" && c.transferType >= 2) ignored.push(c.transferType === 2 ? "search" : "search_transfer");
    if (c.kind === "wr3") {
      if (c.intEnable) ignored.push("int_enable");
      if (c.stopOnMatch) ignored.push("stop_on_match");
      if (c.mask !== undefined || c.match !== undefined) ignored.push("mask/match");
    }
    if (ignored.length > 0) warnings.push({ code: "Z0392", key: at(c.offset), args: [ignored.join(", ")] });
  }
  // --- In source order, then by code
  const lineIndex = (w: DmaWarning<TKey>) => program.lines.findIndex((l) => l.key === w.key);
  return warnings.sort((a, b) => lineIndex(a) - lineIndex(b) || a.code.localeCompare(b.code));
}

/** A program's summary for the editor (§10.3); text is the caller's */
export type DmaProgramSummary = {
  aToB?: boolean;
  /** Port A's and B's start addresses; `patched` when the value is 0 and comes from a data line */
  portA?: number | "patched";
  portB?: number | "patched";
  portAIsIo?: boolean;
  portBIsIo?: boolean;
  /** The block length as written (0 moves one byte) */
  blockLength?: number | "patched";
  /** The operating mode: 0 byte, 1 continuous, 2 burst */
  mode?: number;
  prescaler?: number;
  autoRestart?: boolean;
  /** The program loads ($CF) and enables ($87 or WR3 D6) */
  loads: boolean;
  enables: boolean;
  /** How many bytes the program sends to the DMA */
  length: number;
};

/** Summarises a program (the last value of each setting wins, as in the DMA) */
export function dmaProgramSummary<TKey>(program: DmaProgram<TKey>): DmaProgramSummary {
  const inDmaLine = (offset: number) => program.lines.some((l) => offset >= l.offset && offset < l.offset + l.length);
  const fieldValue = (c: DmaCommand, role: "portA" | "portB" | "length"): number | "patched" | undefined => {
    const f = c.fields.find((x) => x.role === role);
    if (!f) return undefined;
    return f.value === 0 && !inDmaLine(f.offset) ? "patched" : f.value;
  };
  const s: DmaProgramSummary = { loads: false, enables: false, length: program.end - program.start };
  for (const c of program.commands) {
    switch (c.kind) {
      case "wr0":
        s.aToB = c.dirAtoB;
        s.portA = fieldValue(c, "portA") ?? s.portA;
        s.blockLength = fieldValue(c, "length") ?? s.blockLength;
        break;
      case "wr1":
        s.portAIsIo = c.portIsIo;
        break;
      case "wr2":
        s.portBIsIo = c.portIsIo;
        if (c.prescaler !== undefined) s.prescaler = c.prescaler;
        break;
      case "wr4":
        s.mode = c.mode;
        s.portB = fieldValue(c, "portB") ?? s.portB;
        break;
      case "wr5":
        s.autoRestart = c.autoRestart;
        break;
      case "wr6":
        if (c.command === 0xcf) s.loads = true;
        if (c.command === 0x87) s.enables = true;
        if (c.command === 0xc3) s.prescaler = undefined;
        break;
      case "wr3":
        if (c.dmaEnable) s.enables = true;
        break;
    }
  }
  return s;
}

import { z80InstructionLength } from "@common/profile/z80InstructionLength";
import {
  PF_CODE,
  PF_EXECUTED,
  PF_INTERRUPT,
  PF_READ,
  PF_SELF_MODIFIED,
  PF_WRITTEN
} from "@common/profile/profileTypes";

/*
 * Code/data classification from coverage (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §4.2, G7.3).
 *
 * Pure: one bank's (or ROM page's) flags and bytes in, classified runs out, each with the evidence
 * behind it (R4). It decides nothing about the annotations — `proposal.ts` compares the runs with
 * the bank's regions, and the user applies (R3).
 *
 * The per-byte rule, in order:
 * 1. `PF_CODE` → code (observed). Not `PF_EXECUTED` alone, which marks only an instruction's first
 *    byte (D-T1).
 * 2. `PF_READ` or `PF_WRITTEN` → data (observed). Code wins over data on the same byte (D-T3).
 * 3. Reached by the static walk (`reach.ts`) → code (reached).
 * 4. Otherwise unknown: an error handler that never ran is not data (D-T2).
 *
 * Then every instruction start lays its whole instruction down as code, so a run never ends inside
 * one (D-T8); a start that falls inside another instruction's bytes is an overlap (D-T4). Code runs
 * begin at an instruction start; bytes before the first one are reported. Data runs propose `bytes`,
 * refined by inference — text, pointer tables — when asked.
 */

export type ByteClass = "code" | "data" | "unknown";
export type Evidence = "observed" | "reached" | "inferred";
export type RunNote = "smc" | "overlap" | "screen" | "stack" | "interrupt";
/** The region a run proposes. */
export type ProposedType = "disassemble" | "bytes" | "words" | "text" | "skip";

export type ClassifiedRun = {
  /** Inclusive, bank-relative. */
  start: number;
  end: number;
  class: ByteClass;
  evidence: Evidence;
  /** Absent: the run proposes nothing (unknown bytes, kept as they are). */
  proposedType?: ProposedType;
  notes?: RunNote[];
};

export type ClassifyWarning = {
  offset: number;
  kind: "overlap" | "smc" | "data-conflict" | "orphan-operands";
  message: string;
};

export type DetectOptions = {
  /** Mark unknown runs as data (`-unknown bytes`): for a program that was fully exercised. */
  unknown?: "keep" | "bytes";
  /** Propose `text` for printable data runs (`-text`). */
  text?: boolean;
  /** The shortest printable run that counts as text. */
  minText?: number;
  /** Propose `words` for pointer tables (`-words`). */
  words?: boolean;
  /** The screen area to propose as `skip` (D-T5), bank-relative. */
  screen?: { start: number; end: number };
  /** Where SP points in this bank, to name the stack's run (D-T6). */
  stackOffset?: number;
};

export type ClassifyInput = {
  flags: Uint8Array;
  bytes: Uint8Array;
  z80n: boolean;
  /** The static walk's result (`reach.ts`), when `-reach` was asked for. */
  reach?: { reached: Uint8Array; starts: Set<number> };
  /** Whether a 16-bit value points at code or a label in the same 64K view (pointer tables). */
  isCodePointer?: (value: number) => boolean;
  /** As `reach.ts`: the custom disassembler's length for RST 08/28 on the 48K ROM. */
  instructionLength?: (bytes: Uint8Array, offset: number) => number | undefined;
  options?: DetectOptions;
};

export type ClassifyResult = {
  runs: ClassifiedRun[];
  warnings: ClassifyWarning[];
};

const CODE = 1;
const DATA = 2;

const isPrintable = (b: number) => b >= 0x20 && b <= 0x7e;
const isTextEnd = (b: number) => b === 0x0d || b === 0x00 || ((b & 0x80) !== 0 && isPrintable(b & 0x7f));

export function classifyBank(input: ClassifyInput): ClassifyResult {
  const { flags, bytes, z80n, reach } = input;
  const options = input.options ?? {};
  const size = Math.min(flags.length, bytes.length);
  const lengthAt = (offset: number) =>
    input.instructionLength?.(bytes, offset) ?? z80InstructionLength(bytes, offset, z80n);
  const warnings: ClassifyWarning[] = [];

  // --- 1. Per-byte class and evidence
  const cls = new Uint8Array(size);
  const evidence = new Uint8Array(size); // 0 observed, 1 reached, 2 inferred
  for (let i = 0; i < size; i++) {
    const f = flags[i];
    if (f & PF_CODE) cls[i] = CODE;
    else if (f & (PF_READ | PF_WRITTEN)) cls[i] = DATA;
    else if (reach?.reached[i]) {
      cls[i] = CODE;
      evidence[i] = 1;
    }
  }

  // --- 2. Every instruction start lays down its whole instruction (D-T1, D-T8, D-T4)
  const isStart = (i: number) => (flags[i] & PF_EXECUTED) !== 0 || !!reach?.starts.has(i);
  const start = new Uint8Array(size);
  let coveredUntil = 0;
  for (let i = 0; i < size; i++) {
    if (!isStart(i)) continue;
    start[i] = 1;
    if (i < coveredUntil) {
      warnings.push({
        offset: i,
        kind: "overlap",
        message: "An instruction starts inside another instruction's bytes; the earlier decoding is kept."
      });
    }
    const length = Math.min(lengthAt(i), size - i);
    for (let j = i; j < i + length; j++) {
      if (cls[j] === DATA) {
        // --- Code wins (D-T3), but a read of an operand byte is worth a look
        warnings.push({ offset: j, kind: "smc", message: "Code that is also read or written as data." });
      }
      if (cls[j] !== CODE) {
        cls[j] = CODE;
        evidence[j] = (flags[i] & PF_EXECUTED) !== 0 ? 0 : 1;
      }
    }
    coveredUntil = Math.max(coveredUntil, i + length);
  }
  for (let i = 0; i < size; i++) {
    if (cls[i] === CODE && flags[i] & PF_SELF_MODIFIED) {
      warnings.push({ offset: i, kind: "smc", message: "Self-modified code." });
    }
  }

  // --- 3. The screen: anything that is not code proposes skip (D-T5)
  const screen = options.screen;
  const inScreen = (i: number) => !!screen && i >= screen.start && i <= screen.end;

  // --- 4. Runs of one class and evidence
  const runs: ClassifiedRun[] = [];
  const keyOf = (i: number) => (cls[i] === CODE ? `c${evidence[i]}` : inScreen(i) ? "s" : `${cls[i]}${evidence[i]}`);
  for (let i = 0; i < size; ) {
    const key = keyOf(i);
    let j = i;
    while (j + 1 < size && keyOf(j + 1) === key) j++;
    runs.push(...buildRuns(i, j));
    i = j + 1;
  }

  function buildRuns(from: number, to: number): ClassifiedRun[] {
    const ev: Evidence = evidence[from] === 1 ? "reached" : evidence[from] === 2 ? "inferred" : "observed";
    if (cls[from] === CODE) {
      // --- A code run begins at an instruction start; operand bytes before it belong to an
      // --- instruction in another bank, or to an overlap
      let first = from;
      while (first <= to && !start[first]) first++;
      const result: ClassifiedRun[] = [];
      if (first > from) {
        warnings.push({
          offset: from,
          kind: "orphan-operands",
          message: "Code bytes with no instruction start before them in this bank."
        });
        result.push({ start: from, end: Math.min(first, to + 1) - 1, class: "code", evidence: ev, proposedType: "bytes", notes: ["overlap"] });
      }
      if (first <= to) {
        result.push(withNotes({ start: first, end: to, class: "code", evidence: ev, proposedType: "disassemble" }));
      }
      return result;
    }
    if (inScreen(from)) {
      return [withNotes({ start: from, end: to, class: "data", evidence: "inferred", proposedType: "skip", notes: ["screen"] })];
    }
    if (cls[from] === DATA) {
      return inferData(from, to).map(withNotes);
    }
    return [
      withNotes({
        start: from,
        end: to,
        class: "unknown",
        evidence: "observed",
        ...(options.unknown === "bytes" ? { proposedType: "bytes" as const } : {})
      })
    ];
  }

  function withNotes(run: ClassifiedRun): ClassifiedRun {
    const notes = new Set<RunNote>(run.notes ?? []);
    if (options.stackOffset !== undefined && options.stackOffset >= run.start && options.stackOffset <= run.end) {
      notes.add("stack");
    }
    for (let i = run.start; i <= run.end; i++) {
      if (flags[i] & PF_SELF_MODIFIED) notes.add("smc");
      if (run.class === "code" && flags[i] & PF_INTERRUPT) notes.add("interrupt");
    }
    return notes.size > 0 ? { ...run, notes: [...notes] } : run;
  }

  /** A data run, refined into text and pointer tables when asked (§4.5). */
  function inferData(from: number, to: number): ClassifiedRun[] {
    const plain = (s: number, e: number): ClassifiedRun => ({
      start: s,
      end: e,
      class: "data",
      evidence: "observed",
      proposedType: "bytes"
    });
    if (options.words && input.isCodePointer) {
      const length = to - from + 1;
      if (length >= 6 && length % 2 === 0) {
        let hits = 0;
        for (let i = from; i < to; i += 2) {
          if (input.isCodePointer(bytes[i] | (bytes[i + 1] << 8))) hits++;
        }
        if (hits * 5 >= (length / 2) * 4) {
          return [{ start: from, end: to, class: "data", evidence: "inferred", proposedType: "words" }];
        }
      }
    }
    if (!options.text) return [plain(from, to)];
    const minText = Math.max(2, options.minText ?? 4);
    const result: ClassifiedRun[] = [];
    let cursor = from;
    let i = from;
    while (i <= to) {
      if (!isPrintable(bytes[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 <= to && isPrintable(bytes[j + 1])) j++;
      let end = j;
      if (end + 1 <= to && isTextEnd(bytes[end + 1])) end++;
      if (j - i + 1 >= minText) {
        if (i > cursor) result.push(plain(cursor, i - 1));
        result.push({ start: i, end, class: "data", evidence: "inferred", proposedType: "text" });
        cursor = end + 1;
      }
      i = end + 1;
    }
    if (cursor <= to) result.push(plain(cursor, to));
    return result;
  }

  return { runs, warnings: dedupe(warnings) };
}

function dedupe(warnings: ClassifyWarning[]): ClassifyWarning[] {
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const key = `${w.offset}:${w.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Byte counts per evidence level and class, for the proposal summary. */
export function classifiedCounts(runs: readonly ClassifiedRun[]): {
  code: number;
  data: number;
  unknown: number;
  observed: number;
  reached: number;
  inferred: number;
} {
  const counts = { code: 0, data: 0, unknown: 0, observed: 0, reached: 0, inferred: 0 };
  for (const run of runs) {
    const length = run.end - run.start + 1;
    counts[run.class] += length;
    if (run.class !== "unknown") counts[run.evidence] += length;
  }
  return counts;
}

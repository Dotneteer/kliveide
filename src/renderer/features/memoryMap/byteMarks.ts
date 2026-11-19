import type { ByteMarks } from "@renderer/features/memory/MemoryDumpSection";
import type { TypeOver } from "./memoryEdit";

/*
 * The marks a dump row's bytes carry (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §5.1): the cursor,
 * the selection, find matches, memory-breakpoint bytes, bytes changed since a baseline, the byte
 * being typed over, and the selected DMA transfer's ranges. Shared by the live Memory view and the file and bank dumps, so a cursor or a
 * find match looks the same in every one. Built only for rendered rows; `key` sums the marks up so
 * the row's memo comparators compare one string.
 */

export type RowMarkState = {
  cursor?: number;
  selection?: [number, number];
  typeOver?: TypeOver;
  /** Where each find match starts, as indexes of the view */
  matches?: readonly number[];
  /** How many bytes a match covers */
  findLength?: number;
  /** The start of the match the find shows now */
  currentMatch?: number;
  /** Indexes a memory breakpoint watches */
  breakpointBytes?: ReadonlySet<number>;
  /** The bytes at the previous stop, of the same view; a byte that differs gets the changed dot */
  baseline?: ArrayLike<number>;
  bytes?: ArrayLike<number>;
  /**
   * The selected DMA transfer's overlay (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §14.2), as view indexes:
   * the ranges it read and wrote (inclusive) and the working addresses of a running one
   */
  dmaRead?: readonly (readonly [number, number])[];
  dmaWritten?: readonly (readonly [number, number])[];
  dmaNext?: readonly number[];
};

/** The parts of `ranges` inside the row, row-relative */
function clipRanges(ranges: readonly (readonly [number, number])[] | undefined, start: number, end: number, count: number) {
  const out: [number, number][] = [];
  for (const [from, to] of ranges ?? []) {
    if (to < start || from > end) continue;
    out.push([Math.max(0, from - start), Math.min(count - 1, to - start)]);
  }
  return out;
}

/** The marks of the `count` bytes from `start`, or undefined when there are none */
export function rowMarks(start: number, count: number, s: RowMarkState): ByteMarks | undefined {
  const end = start + count - 1;
  const marks: ByteMarks = { key: "" };
  const keys: string[] = [];
  if (s.cursor !== undefined && s.cursor >= start && s.cursor <= end) {
    marks.cursor = s.cursor - start;
    keys.push(`c${marks.cursor}`);
    if (s.typeOver) {
      marks.editText = s.typeOver.text;
      keys.push(`e${s.typeOver.text}`);
    }
  }
  if (s.selection && s.selection[1] >= start && s.selection[0] <= end) {
    marks.selection = [Math.max(0, s.selection[0] - start), Math.min(count - 1, s.selection[1] - start)];
    keys.push(`s${marks.selection.join("-")}`);
  }
  const findLength = s.findLength ?? 0;
  if (findLength > 0 && s.matches?.length) {
    const found: [number, number][] = [];
    for (const m of s.matches) {
      const mEnd = m + findLength - 1;
      if (mEnd < start || m > end) continue;
      const range: [number, number] = [Math.max(0, m - start), Math.min(count - 1, mEnd - start)];
      if (m === s.currentMatch) marks.foundCurrent = range;
      else found.push(range);
    }
    if (found.length) marks.found = found;
    if (found.length || marks.foundCurrent) {
      keys.push(`f${found.map((r) => r.join("-")).join(",")}|${marks.foundCurrent?.join("-") ?? ""}`);
    }
  }
  const dmaRead = clipRanges(s.dmaRead, start, end, count);
  const dmaWritten = clipRanges(s.dmaWritten, start, end, count);
  const dmaNext = (s.dmaNext ?? []).filter((a) => a >= start && a <= end).map((a) => a - start);
  if (dmaRead.length || dmaWritten.length || dmaNext.length) {
    if (dmaRead.length) marks.dmaRead = dmaRead;
    if (dmaWritten.length) marks.dmaWritten = dmaWritten;
    if (dmaNext.length) marks.dmaNext = dmaNext;
    keys.push(`m${dmaRead.map((r) => r.join("-")).join(",")}|${dmaWritten.map((r) => r.join("-")).join(",")}|${dmaNext.join(",")}`);
  }
  let bp: boolean[] | undefined;
  let changed: boolean[] | undefined;
  const hasBaseline = !!s.baseline && !!s.bytes && s.baseline.length === s.bytes.length;
  for (let i = 0; i < count; i++) {
    if (s.breakpointBytes?.has(start + i)) (bp ??= Array(count).fill(false))[i] = true;
    if (hasBaseline && s.baseline![start + i] !== s.bytes![start + i]) (changed ??= Array(count).fill(false))[i] = true;
  }
  if (bp) {
    marks.breakpoint = bp;
    keys.push(`b${bp.map((b) => (b ? 1 : 0)).join("")}`);
  }
  if (changed) {
    marks.changed = changed;
    keys.push(`d${changed.map((b) => (b ? 1 : 0)).join("")}`);
  }
  if (!keys.length) return undefined;
  marks.key = keys.join(";");
  return marks;
}

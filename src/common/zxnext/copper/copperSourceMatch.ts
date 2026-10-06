/*
 * Mapping live Copper RAM back to `.copper` source (`.plans/COPPER_DEBUGGING_PLAN.md` D8, D11, T10).
 *
 * The assembler records every maximal run of `.copper` emissions as a `CopperBlock`. The program
 * uploads such a block into the Copper's RAM at some list offset - often 0, not always - and may
 * patch operands at runtime. So the RAM is matched against the blocks **by instruction shape**
 * (`copperShapeOf`: WAIT, HALT, NOP, or MOVE plus its register), at every alignment:
 *
 * - a match is a contiguous run of equal shapes between the RAM and one block at one alignment;
 * - a run shorter than `minRun` (3) is never claimed, and neither is one made only of NOPs - a
 *   zeroed RAM would otherwise "match" every block that contains a NOP;
 * - longer runs win, then runs with fewer patched operands; an index is claimed once;
 * - an operand that differs from the assembled word marks the row **patched**.
 *
 * Pure and deterministic; no React, no Node.
 */
import type { CopperBlock } from "./copperBlocks";
import { COPPER_LIST_LENGTH, copperShapeOf, copperWordAt } from "./copperDecoder";

/** The minimum run of matching instructions a match must have (T10). */
export const COPPER_MIN_MATCH_RUN = 3;

/** One list index mapped to its source instruction. */
export type CopperSourceMatch = {
  /** The list index */
  index: number;
  /** Index of the block in the `copperBlocks` array */
  block: number;
  /** Index of the entry within the block */
  entry: number;
  fileIndex: number;
  /** 1-based source line */
  line: number;
  /** The live word differs from the assembled one: the CPU patched an operand */
  patched: boolean;
  /** The assembled word */
  sourceWord: number;
};

export type CopperSourceMap = {
  /** By list index; `undefined` where nothing matched */
  byIndex: (CopperSourceMatch | undefined)[];
  /** Per block: how many of its entries are matched somewhere in the RAM ("matched N of M") */
  matchedPerBlock: number[];
};

type Run = { block: number; offset: number; start: number; length: number; patched: number };

/**
 * Matches the live list RAM against the assembled blocks.
 * @param ram The 2K Copper RAM
 * @param blocks The compilation's `copperBlocks`
 * @param minRun The minimum run length to claim
 */
export function matchCopperSource(
  ram: Uint8Array,
  blocks: CopperBlock[] | undefined,
  minRun = COPPER_MIN_MATCH_RUN
): CopperSourceMap {
  const byIndex: (CopperSourceMatch | undefined)[] = new Array(COPPER_LIST_LENGTH).fill(undefined);
  const matchedPerBlock = (blocks ?? []).map(() => 0);
  if (!blocks?.length) return { byIndex, matchedPerBlock };

  const ramWords: number[] = [];
  const ramShapes: string[] = [];
  for (let i = 0; i < COPPER_LIST_LENGTH; i++) {
    const w = copperWordAt(ram, i);
    ramWords.push(w);
    ramShapes.push(copperShapeOf(w));
  }

  // --- Every maximal run of equal shapes, for every block at every alignment
  const runs: Run[] = [];
  blocks.forEach((block, b) => {
    const entryShapes = block.entries.map((e) => copperShapeOf(e.word));
    const n = entryShapes.length;
    // --- RAM index `i` holds entry `i - offset`
    for (let offset = -(n - 1); offset < COPPER_LIST_LENGTH; offset++) {
      let start = -1;
      let patched = 0;
      let meaningful = false;
      const lo = Math.max(0, offset);
      const hi = Math.min(COPPER_LIST_LENGTH, offset + n);
      for (let i = lo; i <= hi; i++) {
        const same = i < hi && ramShapes[i] === entryShapes[i - offset];
        if (same) {
          if (start < 0) {
            start = i;
            patched = 0;
            meaningful = false;
          }
          if (ramWords[i] !== block.entries[i - offset].word) patched++;
          if (entryShapes[i - offset] !== "N") meaningful = true;
        } else if (start >= 0) {
          const length = i - start;
          if (length >= minRun && meaningful) runs.push({ block: b, offset, start, length, patched });
          start = -1;
        }
      }
    }
  });

  // --- Longest first, then the least patched, then the earliest block: deterministic
  runs.sort(
    (a, b) =>
      b.length - a.length || a.patched - b.patched || a.block - b.block || a.start - b.start
  );

  for (const run of runs) {
    // --- Claim only the indexes still free; what is left must still meet the minimum
    const free: number[] = [];
    for (let i = run.start; i < run.start + run.length; i++) if (!byIndex[i]) free.push(i);
    if (free.length < minRun) continue;
    const block = blocks[run.block];
    for (const i of free) {
      const entry = block.entries[i - run.offset];
      byIndex[i] = {
        index: i,
        block: run.block,
        entry: i - run.offset,
        fileIndex: entry.fileIndex,
        line: entry.line,
        patched: ramWords[i] !== entry.word,
        sourceWord: entry.word
      };
    }
  }

  const counted = blocks.map(() => new Set<number>());
  for (const m of byIndex) if (m) counted[m.block].add(m.entry);
  counted.forEach((set, b) => (matchedPerBlock[b] = set.size));
  return { byIndex, matchedPerBlock };
}

/**
 * The list indexes a source line maps to under a match (for a source-line Copper breakpoint, D12).
 * Usually one; more when the same block was uploaded twice.
 */
export function copperIndexesOfSourceLine(
  map: CopperSourceMap,
  fileIndex: number,
  line: number
): number[] {
  return map.byIndex
    .filter((m): m is CopperSourceMatch => !!m && m.fileIndex === fileIndex && m.line === line)
    .map((m) => m.index);
}

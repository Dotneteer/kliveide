import type { DecodedBank, DecodedRow } from "../preprocess/decode";

/*
 * Two versions of a ROM page aligned instruction by instruction (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md`
 * §4.7, P6). The anchors are offsets placed by byte signature (`carry.ts`: the labels the carry placed);
 * between two anchors the instructions are matched in order with their 16-bit operands as wildcards
 * (moved code changes them), by a longest common subsequence.
 *
 * From the matched pairs:
 * - **stretches**: runs where the new page is the old one moved by a constant distance;
 * - **the RAM translation map**: 16-bit operands outside the page that differ between matched
 *   instructions (a system variable that moved), kept only where every pair agrees;
 * - **routine status**: same (the same bytes at the same place), shifted (every instruction matched),
 *   or different (some did not): only the different ones need the AI.
 */

export type Stretch = { oldStart: number; oldEnd: number; newStart: number; newEnd: number; delta: number };

export type RamMapping = { from: number; to: number; count: number };

/** `missing`: none of its instructions matched. */
export type RoutineStatus = "same" | "shifted" | "different" | "missing";

export type RoutineAlignment = {
  old: number;
  new?: number;
  status: RoutineStatus;
  /** Instructions of the old routine with no partner. */
  unmatched: number;
  instructions: number;
};

export type PageAlignment = {
  /** Old instruction start -> new instruction start. */
  pairs: Map<number, number>;
  stretches: Stretch[];
  ramMap: RamMapping[];
  /** Old values that matched more than one new value: never translated. */
  ramConflicts: { from: number; to: number[] }[];
  routines: RoutineAlignment[];
};

export type AlignInputs = {
  oldDecoded: DecodedBank;
  newDecoded: DecodedBank;
  oldBytes: Uint8Array;
  newBytes: Uint8Array;
  /** Old offset -> new offset: places both pages agree on (the carried labels). */
  anchors: ReadonlyMap<number, number>;
  /** The old routines to report on: start and end (inclusive). */
  oldRoutines: readonly { start: number; end: number }[];
};

/** The largest instruction run matched by the quadratic LCS; longer gaps are matched greedily. */
const LCS_LIMIT = 250_000;

export function alignPages(inputs: AlignInputs): PageAlignment {
  const { oldDecoded, newDecoded } = inputs;
  const oldRows = oldDecoded.rows;
  const newRows = newDecoded.rows;
  const oldIndex = new Map(oldRows.map((r, i) => [r.offset, i]));
  const newIndex = new Map(newRows.map((r, i) => [r.offset, i]));

  // --- Anchors that are instruction starts on both sides, in increasing order on both
  const anchors = [...inputs.anchors]
    .filter(([o, n]) => oldIndex.has(o) && newIndex.has(n))
    .sort((a, b) => a[0] - b[0]);
  const ordered = increasing(anchors);

  const pairs = new Map<number, number>();
  const bounds: [number, number][] = [[0, 0], ...ordered.map(([o, n]) => [oldIndex.get(o)!, newIndex.get(n)!] as [number, number]), [oldRows.length, newRows.length]];
  for (let k = 0; k + 1 < bounds.length; k++) {
    const [oa, na] = bounds[k];
    const [ob, nb] = bounds[k + 1];
    for (const [i, j] of matchRun(oldRows, oa, ob, newRows, na, nb)) pairs.set(oldRows[i].offset, newRows[j].offset);
  }

  return {
    pairs,
    stretches: stretchesOf(pairs, oldDecoded),
    ...ramMapOf(pairs, oldDecoded, newDecoded),
    routines: inputs.oldRoutines.map((r) => routineStatus(r, pairs, oldDecoded, inputs.oldBytes, inputs.newBytes))
  };
}

/** An instruction with its 16-bit operands as wildcards. */
function shape(row: DecodedRow): string {
  return row.text.replace(/\$[0-9A-F]{4}\b/g, "nn");
}

/** Matches rows old[oa, ob) with new[na, nb) in order. */
function matchRun(oldRows: DecodedRow[], oa: number, ob: number, newRows: DecodedRow[], na: number, nb: number): [number, number][] {
  const n = ob - oa;
  const m = nb - na;
  if (!n || !m) return [];
  if (n * m > LCS_LIMIT) return greedy(oldRows, oa, ob, newRows, na, nb);
  const a = oldRows.slice(oa, ob).map(shape);
  const b = newRows.slice(na, nb).map(shape);
  // --- Lengths of the longest common subsequences of the suffixes
  const table = new Uint16Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[at(i, j)] = a[i] === b[j] ? table[at(i + 1, j + 1)] + 1 : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
    }
  }
  const result: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push([oa + i, na + j]);
      i++;
      j++;
    } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) i++;
    else j++;
  }
  return result;
}

/** A long gap: walk both sides, pairing equal shapes and resynchronising on the next equal one nearby. */
function greedy(oldRows: DecodedRow[], oa: number, ob: number, newRows: DecodedRow[], na: number, nb: number): [number, number][] {
  const result: [number, number][] = [];
  let i = oa;
  let j = na;
  while (i < ob && j < nb) {
    if (shape(oldRows[i]) === shape(newRows[j])) {
      result.push([i++, j++]);
      continue;
    }
    let found = false;
    for (let d = 1; d <= 32 && !found; d++) {
      if (j + d < nb && shape(oldRows[i]) === shape(newRows[j + d])) {
        j += d;
        found = true;
      } else if (i + d < ob && shape(oldRows[i + d]) === shape(newRows[j])) {
        i += d;
        found = true;
      }
    }
    if (!found) {
      i++;
      j++;
    }
  }
  return result;
}

/** Runs of matched instructions that follow each other on both sides at one distance. */
function stretchesOf(pairs: Map<number, number>, oldDecoded: DecodedBank): Stretch[] {
  const stretches: Stretch[] = [];
  let current: Stretch | undefined;
  for (const row of oldDecoded.rows) {
    const to = pairs.get(row.offset);
    if (to === undefined) {
      current = undefined;
      continue;
    }
    const delta = to - row.offset;
    if (current && current.delta === delta && current.oldEnd + 1 === row.offset) {
      current.oldEnd = row.offset + row.length - 1;
      current.newEnd = to + row.length - 1;
    } else {
      current = { oldStart: row.offset, oldEnd: row.offset + row.length - 1, newStart: to, newEnd: to + row.length - 1, delta };
      stretches.push(current);
    }
  }
  return stretches;
}

/** 16-bit operands outside the page that differ between matched instructions. */
function ramMapOf(pairs: Map<number, number>, oldDecoded: DecodedBank, newDecoded: DecodedBank): Pick<PageAlignment, "ramMap" | "ramConflicts"> {
  const seen = new Map<number, Map<number, number>>();
  const inPage = (value: number, d: DecodedBank) => value >= d.origin && value < d.origin + 0x4000;
  for (const [o, n] of pairs) {
    const oldRow = oldDecoded.at.get(o)!;
    const newRow = newDecoded.at.get(n)!;
    if (oldRow.branch || newRow.branch) continue;
    const before = [...oldRow.text.matchAll(/\$([0-9A-F]{4})\b/g)].map((m) => parseInt(m[1], 16));
    const after = [...newRow.text.matchAll(/\$([0-9A-F]{4})\b/g)].map((m) => parseInt(m[1], 16));
    if (before.length !== after.length) continue;
    before.forEach((from, i) => {
      const to = after[i];
      if (inPage(from, oldDecoded) || inPage(to, newDecoded)) return;
      const targets = seen.get(from) ?? new Map<number, number>();
      targets.set(to, (targets.get(to) ?? 0) + 1);
      seen.set(from, targets);
    });
  }
  const ramMap: RamMapping[] = [];
  const ramConflicts: { from: number; to: number[] }[] = [];
  for (const [from, targets] of [...seen].sort((a, b) => a[0] - b[0])) {
    if (targets.size > 1) ramConflicts.push({ from, to: [...targets.keys()] });
    else {
      const [[to, count]] = [...targets];
      if (to !== from) ramMap.push({ from, to, count });
    }
  }
  return { ramMap, ramConflicts };
}

function routineStatus(
  routine: { start: number; end: number },
  pairs: Map<number, number>,
  oldDecoded: DecodedBank,
  oldBytes: Uint8Array,
  newBytes: Uint8Array
): RoutineAlignment {
  const rows = oldDecoded.rows.filter((r) => r.offset >= routine.start && r.offset <= routine.end && !r.data);
  const unmatched = rows.filter((r) => !pairs.has(r.offset)).length;
  let to = pairs.get(routine.start);
  if (to === undefined) {
    // --- Its first instruction changed: placed from its first one that matched, else missing
    const anchor = rows.find((r) => pairs.has(r.offset));
    if (!anchor) return { old: routine.start, status: "missing", unmatched, instructions: rows.length };
    to = pairs.get(anchor.offset)! - (anchor.offset - routine.start);
    return { old: routine.start, new: to, status: "different", unmatched, instructions: rows.length };
  }
  let same = to === routine.start && unmatched === 0;
  for (let o = routine.start; same && o <= routine.end; o++) if (oldBytes[o] !== newBytes[o]) same = false;
  return {
    old: routine.start,
    new: to,
    status: same ? "same" : unmatched === 0 ? "shifted" : "different",
    unmatched,
    instructions: rows.length
  };
}

/** The longest run of pairs increasing on both sides (patience-style). */
function increasing(pairs: [number, number][]): [number, number][] {
  const tails: number[] = [];
  const previous: number[] = new Array(pairs.length).fill(-1);
  const tailIndex: number[] = [];
  pairs.forEach(([, n], i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < n) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = n;
    tailIndex[lo] = i;
    previous[i] = lo > 0 ? tailIndex[lo - 1] : -1;
  });
  const result: [number, number][] = [];
  for (let i = tailIndex[tails.length - 1] ?? -1; i >= 0; i = previous[i]) result.push(pairs[i]);
  return result.reverse();
}

/** Carried text with the RAM addresses that moved translated; returns the text and the swaps made. */
export function translateRam(text: string, ramMap: readonly RamMapping[]): { text: string; swaps: string[] } {
  const map = new Map(ramMap.map((m) => [m.from, m.to]));
  const swaps: string[] = [];
  const result = text.replace(/\$([0-9A-Fa-f]{4})(?![0-9A-Fa-f])/g, (match, digits) => {
    const to = map.get(parseInt(digits, 16));
    if (to === undefined) return match;
    const replacement = `$${to.toString(16).padStart(4, "0").toUpperCase()}`;
    swaps.push(`${match} -> ${replacement}`);
    return replacement;
  });
  return { text: result, swaps };
}

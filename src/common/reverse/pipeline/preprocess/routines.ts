import type { BinaryImage } from "../image/binaryImage";
import { rowAt, type DecodedBank, type DecodedRow } from "./decode";

/*
 * Stages 2, 6 and 7 (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.1): the entries, with the evidence
 * for each; the routines they cut the code into; and the call graph between them.
 *
 * A routine is an entry and the rows it owns up to the next entry. Its kind follows D10: a
 * *subroutine* is entered by `CALL`, `RST` or a table and reaches a return; a *jump target* is reached
 * only by jumps or by falling through (a loop, a shared exit); an *entry point* is reached from outside
 * (a CPU vector, the ROM format); *unreached* has no known way in.
 */

export type EntrySource = "cpu-vector" | "format" | "label" | "region" | "call" | "rst" | "jump" | "table" | "profile";

export type EntryEvidence = { source: EntrySource; from?: number; note?: string };

export type CallerKind = "call" | "rst" | "jump" | "fall-through" | "table" | "profile";

export type RoutineKind = "subroutine" | "jump-target" | "entry-point" | "unreached";

export type Routine = {
  start: number;
  /** The last byte the routine owns. */
  end: number;
  rows: DecodedRow[];
  label?: string;
  evidence: EntryEvidence[];
  callers: { from: number; how: CallerKind }[];
  /** `CALL`/`RST` rows in the routine and where they go. */
  calls: { at: number; target?: number; address?: number; how: "call" | "rst" }[];
  /** Jumps that leave the routine: to another routine, or out of the bank. */
  jumpsOut: { at: number; target?: number; address?: number }[];
  kind: RoutineKind;
  /** A return is reachable from the entry without leaving through a call. */
  returns: boolean;
  /** The last row flows on into the next routine. */
  fallsThrough: boolean;
};

export type RoutineMap = {
  routines: Routine[];
  /** The routine starting at an offset. */
  at: Map<number, Routine>;
  /** The routine owning an offset. */
  owner(offset: number): Routine | undefined;
  /** Targets that land inside an instruction, with the rows that name them. */
  midInstructionTargets: { target: number; from: number }[];
};

export type RoutineInputs = {
  image: BinaryImage;
  decoded: DecodedBank;
  labels?: readonly { name: string; value: number }[];
  /** The sidecar's `words` regions: words that point at code are table entries. */
  wordTables?: readonly { start: number; end: number }[];
  /** Instruction starts a profile run saw executed, and callees of its call edges (bank offsets). */
  profileEntries?: readonly number[];
};

/** The rows that can run after `row`, as bank offsets (a `CALL` returns: the callee is not followed). */
export function successors(row: DecodedRow, decoded: DecodedBank): { next?: number; target?: number } {
  const after = nextInstruction(row, decoded);
  const branch = row.branch;
  if (!branch) return after === undefined ? {} : { next: after };
  switch (branch.kind) {
    case "jp":
    case "jr":
      return branch.condition ? { next: after, target: branch.target } : { target: branch.target };
    case "djnz":
      return { next: after, target: branch.target };
    case "call":
    case "rst":
      return after === undefined ? {} : { next: after };
    case "ret":
      return branch.condition ? { next: after } : {};
    case "jp-indirect":
      return {};
  }
  return { next: after };
}

/** The next instruction start after a row, stepping over inline data; undefined at the end of code. */
export function nextInstruction(row: DecodedRow, decoded: DecodedBank): number | undefined {
  let offset = row.offset + row.length;
  for (;;) {
    const next = rowAt(decoded, offset);
    if (!next) return undefined;
    if (!next.data) return offset;
    offset += next.length;
  }
}

export function buildRoutines(inputs: RoutineInputs): RoutineMap {
  const { decoded } = inputs;
  const evidence = new Map<number, EntryEvidence[]>();
  const add = (offset: number, e: EntryEvidence) => {
    const row = decoded.at.get(offset);
    if (!row || row.data) return false;
    evidence.set(offset, [...(evidence.get(offset) ?? []), e]);
    return true;
  };
  const bankId = decoded.bankId;

  for (const entry of inputs.image.entries) if (entry.bank === bankId) add(entry.offset, { source: entry.source, note: entry.note });
  for (const label of inputs.labels ?? []) add(label.value, { source: "label", note: label.name });
  for (const region of decoded.code) add(region.start, { source: "region" });
  for (const offset of inputs.profileEntries ?? []) add(offset, { source: "profile" });

  const midInstructionTargets: { target: number; from: number }[] = [];
  const callerEdges: { to: number; from: number; how: CallerKind }[] = [];
  for (const row of decoded.rows) {
    const branch = row.branch;
    if (!branch || branch.target === undefined) continue;
    const how: CallerKind = branch.kind === "call" ? "call" : branch.kind === "rst" ? "rst" : "jump";
    if (add(branch.target, { source: how, from: row.offset })) callerEdges.push({ to: branch.target, from: row.offset, how });
    else if (!decoded.at.has(branch.target) && inCode(decoded, branch.target)) midInstructionTargets.push({ target: branch.target, from: row.offset });
  }
  for (const table of inputs.wordTables ?? []) {
    for (let at = table.start; at + 1 <= table.end; at += 2) {
      const word = wordAt(decoded, inputs.image, at);
      const target = word - decoded.origin;
      if (word >= decoded.origin && target < decoded.size && add(target, { source: "table", from: at })) {
        callerEdges.push({ to: target, from: at, how: "table" });
      }
    }
  }

  // --- Cut the code into routines
  const starts = [...evidence.keys()].sort((a, b) => a - b);
  const routines: Routine[] = [];
  const labelAt = new Map((inputs.labels ?? []).map((l) => [l.value, l.name]));
  starts.forEach((start, i) => {
    const region = decoded.code.find((r) => start >= r.start && start <= r.end)!;
    const limit = Math.min(i + 1 < starts.length ? starts[i + 1] - 1 : Infinity, region.end);
    const rows = rowsBetween(decoded, start, limit);
    const last = rows[rows.length - 1];
    routines.push({
      start,
      end: last ? last.offset + last.length - 1 : start,
      rows,
      ...(labelAt.has(start) ? { label: labelAt.get(start) } : {}),
      evidence: evidence.get(start)!,
      callers: [],
      calls: [],
      jumpsOut: [],
      kind: "unreached",
      returns: false,
      fallsThrough: false
    });
  });
  const at = new Map(routines.map((r) => [r.start, r]));
  const owner = (offset: number) => {
    let lo = 0;
    let hi = routines.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = routines[mid];
      if (offset < r.start) hi = mid - 1;
      else if (offset > r.end) lo = mid + 1;
      else return r;
    }
    return undefined;
  };

  // --- Edges: callers, calls, jumps out, fall-through
  for (const edge of callerEdges) at.get(edge.to)?.callers.push({ from: edge.from, how: edge.how });
  for (const offset of inputs.profileEntries ?? []) at.get(offset)?.callers.push({ from: -1, how: "profile" });
  for (const routine of routines) {
    for (const row of routine.rows) {
      const branch = row.branch;
      if (!branch) continue;
      if (branch.kind === "call" || branch.kind === "rst") {
        routine.calls.push({ at: row.offset, ...(branch.target !== undefined ? { target: branch.target } : {}), ...(branch.address !== undefined ? { address: branch.address } : {}), how: branch.kind });
      } else if ((branch.kind === "jp" || branch.kind === "jr" || branch.kind === "djnz") && (branch.target === undefined || branch.target < routine.start || branch.target > routine.end)) {
        routine.jumpsOut.push({ at: row.offset, ...(branch.target !== undefined ? { target: branch.target } : {}), ...(branch.address !== undefined ? { address: branch.address } : {}) });
      }
    }
    const last = routine.rows.filter((r) => !r.data).pop();
    if (last) {
      const next = successors(last, decoded).next;
      if (next !== undefined && next > routine.end) {
        routine.fallsThrough = true;
        at.get(next)?.callers.push({ from: last.offset, how: "fall-through" });
      }
    }
  }

  // --- Kinds (D10): called and returning is a subroutine; called but never returning, or entered from
  // --- outside (a vector, the ROM format, only a profile run), an entry point; jumped to, a jump target
  for (const routine of routines) {
    routine.returns = reachesReturn(routine.start, decoded);
    const called = routine.callers.some((c) => c.how === "call" || c.how === "rst" || c.how === "table");
    const jumped = routine.callers.some((c) => c.how === "jump" || c.how === "fall-through");
    const vector = routine.evidence.some((e) => e.source === "cpu-vector" || e.source === "format");
    const restart = routine.evidence.some((e) => e.source === "cpu-vector" && e.note?.startsWith("RST"));
    if ((called || restart) && routine.returns) routine.kind = "subroutine";
    else if (called || vector || routine.callers.some((c) => c.how === "profile")) routine.kind = "entry-point";
    else if (jumped) routine.kind = "jump-target";
    else routine.kind = "unreached";
  }
  return { routines, at, owner, midInstructionTargets };
}

/** Whether a return is reachable from `start` along jumps and fall-through (calls are assumed to return). */
export function reachesReturn(start: number, decoded: DecodedBank): boolean {
  const seen = new Set<number>();
  const work = [start];
  while (work.length) {
    const offset = work.pop()!;
    if (seen.has(offset)) continue;
    seen.add(offset);
    const row = rowAt(decoded, offset);
    if (!row || row.data) continue;
    if (row.branch?.kind === "ret") return true;
    const { next, target } = successors(row, decoded);
    if (next !== undefined) work.push(next);
    if (target !== undefined) work.push(target);
  }
  return false;
}

/** The rows from `start` to `end` (inclusive), by binary search over the sorted rows. */
function rowsBetween(decoded: DecodedBank, start: number, end: number): DecodedRow[] {
  const rows = decoded.rows;
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].offset < start) lo = mid + 1;
    else hi = mid;
  }
  const result: DecodedRow[] = [];
  for (let i = lo; i < rows.length && rows[i].offset <= end; i++) result.push(rows[i]);
  return result;
}

function inCode(decoded: DecodedBank, offset: number): boolean {
  return decoded.code.some((r) => offset >= r.start && offset <= r.end);
}

function wordAt(decoded: DecodedBank, image: BinaryImage, offset: number): number {
  const bytes = image.banks.find((b) => b.id === decoded.bankId)!.bytes;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

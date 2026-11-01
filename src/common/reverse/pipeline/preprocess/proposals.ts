import { MemorySectionType } from "@abstractions/MemorySection";
import { PF_CODE, PF_EXECUTED, PF_READ } from "@common/profile/profileTypes";
import { classifyBank, type ClassifiedRun } from "@common/reverse/classify";
import { reachBank } from "@common/reverse/reach";
import { prepareRomDisassembler } from "@renderer/appIde/annotations/romDecoder";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { imageBank, type BinaryImage } from "../image/binaryImage";
import type { DecodedBank } from "./decode";

/*
 * Stages 4 and 5 of the preprocessor (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.1, §4.4, P4): code
 * and data, told apart from the evidence, compared with the page's current regions, and proposed as
 * region changes, each with what backs it and what it changes.
 *
 * The evidence: the static walk from trusted starts (`reach.ts`; the CPU vectors, the profile's runs,
 * the sidecar's labels in its code) and the profile's flags (`classify.ts`: fetched is code, only read
 * is data), with text and pointer tables inferred. A proposal never applies itself: the AI accepts it
 * into a `.ann` file (`proposals.ann` lists them ready to uncomment).
 */

export type ProposalKind = "code" | "bytes" | "words" | "text" | "fill";

export type RegionProposal = {
  start: number;
  end: number;
  kind: ProposalKind;
  /** Why: the classifier's evidence, or the observation behind it. */
  evidence: string;
  /** The page's current region kinds over these bytes. */
  current: string;
  /** Control-transfer targets that only rows inside the range name: false targets it removes. */
  targetsRemoved: number;
  /** Of them, targets that land inside an instruction. */
  midInstructionRemoved: number;
  /** Rows that load the range's start address (`LD HL,table`), as `offset: text`. */
  readers: string[];
};

export type ProposalInputs = {
  image: BinaryImage;
  bankId: string;
  decoded: DecodedBank;
  /** The page's current regions; all code when absent. */
  regions?: readonly { start: number; end: number; type: string; decode?: string }[];
  labels: ReadonlyMap<number, string>;
  flags?: readonly number[];
  /** Instruction starts a profile run entered (call edges' callees). */
  profileEntries?: readonly number[];
};

export type ProposalResult = {
  proposals: RegionProposal[];
  /** Evidence that disagrees and needs a person (or an AI) to look: never proposed. */
  conflicts: string[];
};

/**
 * The page's region proposals, in offset order. Only a run turns a declared data region into code (a
 * walk can fall through into a table after a call that never returns), and bytes a run read that the
 * walk reaches as code are a conflict, not data (a ROM reading its own header): both are listed as
 * conflicts instead.
 */
export async function proposeRegions(inputs: ProposalInputs): Promise<ProposalResult> {
  const { image, decoded } = inputs;
  const bank = imageBank(image, inputs.bankId);
  const size = bank.bytes.length;
  const flags = new Uint8Array(size);
  if (inputs.flags) flags.set(inputs.flags.slice(0, size));
  const regions = inputs.regions?.length ? inputs.regions : [{ start: 0, end: size - 1, type: "disassemble" }];
  const isCodeRegion = (offset: number) => regions.some((r) => r.type === "disassemble" && offset >= r.start && offset <= r.end);

  // --- Trusted starts: the CPU's vectors, the runs, and labels the sidecar put in its code
  const seeds = new Set<number>();
  for (const entry of image.entries) if (entry.bank === inputs.bankId) seeds.add(entry.offset);
  for (let offset = 0; offset < size; offset++) if (flags[offset] & PF_EXECUTED) seeds.add(offset);
  for (const offset of inputs.profileEntries ?? []) seeds.add(offset);
  if (inputs.regions?.length) for (const offset of inputs.labels.keys()) if (isCodeRegion(offset)) seeds.add(offset);

  const lengths = await customLengths(image, inputs.bankId);
  const instructionLength = (_: Uint8Array, offset: number) => lengths.get(offset);
  const reach = reachBank({
    bytes: bank.bytes,
    flags,
    z80n: image.cpu === "z80n",
    seeds,
    bankOffsetOf: (address) => (address >= bank.origin && address < bank.origin + size ? address - bank.origin : undefined),
    addressOf: (offset) => bank.origin + offset,
    instructionLength
  });
  // --- The same walk without the run's flags: whether code reaches bytes the run only read
  const staticReach = reachBank({
    bytes: bank.bytes,
    z80n: image.cpu === "z80n",
    seeds,
    bankOffsetOf: (address) => (address >= bank.origin && address < bank.origin + size ? address - bank.origin : undefined),
    addressOf: (offset) => bank.origin + offset,
    instructionLength
  });
  const { runs } = classifyBank({
    flags,
    bytes: bank.bytes,
    z80n: image.cpu === "z80n",
    reach,
    isCodePointer: (value) => value >= bank.origin && reach.starts.has(value - bank.origin),
    instructionLength,
    options: { text: true, minText: 6, words: true }
  });

  const proposals: RegionProposal[] = [];
  const conflicts: string[] = [];
  for (const run of runs) {
    for (const part of differences(run, regions)) {
      if (part.kind === "code" && run.evidence !== "observed") {
        conflicts.push(`$${hex(part.start)}-$${hex(part.end)}: the walk reaches into this ${part.current} region, but no run executed it (a call that never returns, falling into data?)`);
        continue;
      }
      // --- Data over code: the bytes the walk reaches as code stay out of the proposal
      for (const piece of splitBy(part.start, part.end, (o) => part.kind !== "code" && part.current === "code" && staticReach.reached[o] === 1)) {
        if (piece.marked) {
          conflicts.push(`$${hex(piece.start)}-$${hex(piece.end)}: read as data in the run, and reached as code by the walk (code that reads itself, or a table after code?)`);
        } else {
          proposals.push(describe(inputs, piece.start, piece.end, part.kind, evidenceOf(run), part.current));
        }
      }
    }
  }
  proposals.push(...inlineAfterCalls(inputs, flags, regions));
  // --- Detectors over bytes no run executed and no walk reaches (a byte a run only read is data: the
  // --- length bytes of counted texts are read to step through them)
  const untouched = (o: number) => !staticReach.reached[o] && !(flags[o] & (PF_CODE | PF_EXECUTED));
  const isCodePointer = (value: number) => value >= bank.origin && reach.starts.has(value - bank.origin);
  // --- (only over bytes still listed as code: a data region an author declared is their decision)
  const loaded = new Set(
    decoded.rows.filter((r) => !r.data && !r.branch && r.bytes.length >= 3).map((r) => r.bytes[r.bytes.length - 2] | (r.bytes[r.bytes.length - 1] << 8))
  );
  // --- Consecutive non-code runs are scanned as one stretch: a counted text's read length byte is a
  // --- run of its own
  const stretches: { start: number; end: number }[] = [];
  for (const run of runs.filter((r) => r.class !== "code")) {
    const last = stretches[stretches.length - 1];
    if (last && last.end + 1 === run.start) last.end = run.end;
    else stretches.push({ start: run.start, end: run.end });
  }
  for (const run of stretches) {
    for (const found of detectTables(bank.bytes, run.start, run.end, (o) => untouched(o) && isCodeRegion(o), isCodePointer, (o) => loaded.has(bank.origin + o))) {
      proposals.push(describe(inputs, found.start, found.end, found.kind, found.evidence, "code"));
    }
  }
  return { proposals: mergeOverlaps(proposals).sort((a, b) => a.start - b.start), conflicts };
}

/** The shortest printable run, and the fewest words, a detector proposes. */
const MIN_TEXT = 6;
const MIN_WORDS = 2;
const MIN_WORDS_UNLOADED = 4;
const MIN_FILL = 16;

const printable = (b: number) => b >= 0x20 && b <= 0x7e;

/**
 * Texts and pointer tables in bytes the evidence says nothing about: a printable run ended by 0, CR or
 * a byte with bit 7 set on a printable character; two or more words in a row that each point at code
 * the walk reached.
 */
function detectTables(
  bytes: Uint8Array,
  start: number,
  end: number,
  usable: (offset: number) => boolean,
  isCodePointer: (value: number) => boolean,
  isLoaded: (offset: number) => boolean
): { start: number; end: number; kind: ProposalKind; evidence: string }[] {
  const found: { start: number; end: number; kind: ProposalKind; evidence: string }[] = [];
  let o = start;
  while (o <= end) {
    if (!usable(o)) {
      o++;
      continue;
    }
    // --- A fill: 16 or more of one byte
    let f = o;
    while (f <= end && usable(f) && bytes[f] === bytes[o]) f++;
    if (f - o >= MIN_FILL) {
      found.push({ start: o, end: f - 1, kind: "fill", evidence: `inferred: ${f - o} bytes of $${hex(bytes[o]).slice(2)}` });
      o = f;
      continue;
    }
    // --- Counted texts: a length byte, then that many mostly printable bytes, two or more in a row
    let c = o;
    let counted = 0;
    while (c <= end && usable(c) && bytes[c] >= 3 && bytes[c] <= 80 && c + bytes[c] <= end) {
      const body = bytes.subarray(c + 1, c + 1 + bytes[c]);
      if (!Array.from(body).every((_, i) => usable(c + 1 + i)) || body.filter(printable).length < body.length * 0.9) break;
      c += 1 + bytes[c];
      counted++;
    }
    if (counted >= 2) {
      const first = String.fromCharCode(...bytes.subarray(o + 1, o + 1 + Math.min(bytes[o], 24)));
      found.push({ start: o, end: c - 1, kind: "text", evidence: `inferred: ${counted} counted texts (a length byte first), "${first}"...` });
      o = c;
      continue;
    }
    // --- Distinct words that point at code (not fill: $0000, $FFFF); a table some code loads needs two,
    // --- one nothing loads needs four
    let w = o;
    const seen = new Set<number>();
    for (;;) {
      if (w + 1 > end || !usable(w) || !usable(w + 1)) break;
      const value = bytes[w] | (bytes[w + 1] << 8);
      if (value === 0 || value === 0xffff || seen.has(value) || !isCodePointer(value)) break;
      seen.add(value);
      w += 2;
    }
    const words = (w - o) / 2;
    if (words >= (isLoaded(o) ? MIN_WORDS : MIN_WORDS_UNLOADED)) {
      found.push({ start: o, end: w - 1, kind: "words", evidence: `inferred: ${words} words, each the address of code the walk reached${isLoaded(o) ? "" : " (nothing loads its address)"}` });
      o = w;
      continue;
    }
    // --- Printable text with an end mark
    let t = o;
    while (t <= end && usable(t) && printable(bytes[t])) t++;
    const mark = bytes[t];
    const ends = t <= end && usable(t) && (mark === 0x00 || mark === 0x0d || ((mark & 0x80) !== 0 && printable(mark & 0x7f)));
    const letters = Array.from(bytes.subarray(o, t)).filter((b) => /[A-Za-z ]/.test(String.fromCharCode(b))).length;
    if (t - o >= MIN_TEXT && ends && letters >= (t - o) * 0.6) {
      const text = String.fromCharCode(...bytes.subarray(o, Math.min(t, o + 24)));
      found.push({ start: o, end: t, kind: "text", evidence: `inferred: printable text "${text}${t - o > 24 ? "..." : ""}" ended by $${hex(mark).slice(2)}` });
      o = t + 1;
      continue;
    }
    o = Math.max(o + 1, t);
  }
  return found;
}

/** Cuts start..end into runs where `marked` is the same. */
function splitBy(start: number, end: number, marked: (offset: number) => boolean): { start: number; end: number; marked: boolean }[] {
  const pieces: { start: number; end: number; marked: boolean }[] = [];
  for (let o = start; o <= end; o++) {
    const m = marked(o);
    const last = pieces[pieces.length - 1];
    if (last && last.marked === m && last.end === o - 1) last.end = o;
    else pieces.push({ start: o, end: o, marked: m });
  }
  return pieces;
}

/** The parts of a classified run that differ from the current regions. */
function differences(
  run: ClassifiedRun,
  regions: readonly { start: number; end: number; type: string; decode?: string }[]
): { start: number; end: number; kind: ProposalKind; current: string }[] {
  if (run.class === "unknown" || !run.proposedType || run.proposedType === "skip") return [];
  const kind: ProposalKind = run.class === "code" ? "code" : run.proposedType === "disassemble" ? "bytes" : (run.proposedType as ProposalKind);
  const result: { start: number; end: number; kind: ProposalKind; current: string }[] = [];
  for (const region of regions) {
    const start = Math.max(run.start, region.start);
    const end = Math.min(run.end, region.end);
    if (start > end) continue;
    const current = region.type === "disassemble" ? "code" : region.decode ?? region.type;
    const differs =
      (kind === "code" && region.type !== "disassemble") ||
      (kind !== "code" && region.type === "disassemble") ||
      // --- A refinement of data: bytes that are text or a pointer table
      (kind !== "code" && region.type === "bytes" && !region.decode && (kind === "text" || kind === "words"));
    if (differs) result.push({ start, end, kind, current });
  }
  return result;
}

function evidenceOf(run: ClassifiedRun): string {
  const how = run.class === "code" ? (run.evidence === "observed" ? "ran in the profile" : "reached by the walk") : run.evidence === "observed" ? "read in the profile, never run" : "inferred";
  const what = run.proposedType === "text" ? "printable text" : run.proposedType === "words" ? "a table of words that point at code" : "";
  return [how, what, ...(run.notes ?? [])].filter(Boolean).join("; ");
}

/** Bytes right after a CALL or RST that a run read and never ran: inline data the callee takes. */
function inlineAfterCalls(
  inputs: ProposalInputs,
  flags: Uint8Array,
  regions: readonly { start: number; end: number; type: string }[]
): RegionProposal[] {
  if (!inputs.flags) return [];
  const proposals: RegionProposal[] = [];
  const inCode = (offset: number) => regions.some((r) => r.type === "disassemble" && offset >= r.start && offset <= r.end);
  for (const row of inputs.decoded.rows) {
    if (row.data || (row.branch?.kind !== "call" && row.branch?.kind !== "rst")) continue;
    let end = row.offset + row.length;
    // --- The custom decoder already took it (an EXOS call's function byte): nothing to propose
    if (inputs.decoded.at.get(end)?.data) continue;
    const start = end;
    while (end < flags.length && flags[end] & PF_READ && !(flags[end] & (PF_CODE | PF_EXECUTED)) && inCode(end)) end++;
    if (end > start) {
      const callee = row.branch.target !== undefined ? inputs.labels.get(row.branch.target) ?? `$${hex(row.branch.target)}` : `$${hex(row.branch.address ?? 0)}`;
      proposals.push(describe(inputs, start, end - 1, "bytes", `read after ${row.text} (${callee}) and never run: inline data the callee takes`, "code"));
    }
  }
  return proposals;
}

function describe(inputs: ProposalInputs, start: number, end: number, kind: ProposalKind, evidence: string, current: string): RegionProposal {
  const { decoded } = inputs;
  const inside = (o: number) => o >= start && o <= end;
  let targetsRemoved = 0;
  let midInstructionRemoved = 0;
  if (kind !== "code") {
    const namedOutside = new Set<number>();
    const namedInside = new Set<number>();
    for (const row of decoded.rows) {
      const target = row.branch?.target;
      if (target === undefined) continue;
      (inside(row.offset) ? namedInside : namedOutside).add(target);
    }
    for (const target of namedInside) {
      if (namedOutside.has(target)) continue;
      targetsRemoved++;
      if (!decoded.at.has(target)) midInstructionRemoved++;
    }
  }
  const address = decoded.origin + start;
  const readers = decoded.rows
    .filter((r) => !r.data && !r.branch && r.bytes.length >= 3 && (r.bytes[r.bytes.length - 2] | (r.bytes[r.bytes.length - 1] << 8)) === address)
    .map((r) => `$${hex(r.offset)}: ${r.text}`);
  return { start, end, kind, evidence, current, targetsRemoved, midInstructionRemoved, readers };
}

/**
 * Where two proposals overlap, the earlier wins and the other is cut; at one start a detector's (text,
 * words, fill) wins over plain bytes, and the longer over the shorter.
 */
function mergeOverlaps(proposals: RegionProposal[]): RegionProposal[] {
  const rank = (p: RegionProposal) => (p.kind === "bytes" ? 1 : 0);
  const covered = proposals.filter((p) => p.kind !== "bytes" && p.kind !== "code");
  // --- Plain bytes inside a detector's proposal add nothing
  const kept = proposals.filter((p) => p.kind !== "bytes" || !covered.some((c) => c.start <= p.start && p.end <= c.end));
  const sorted = [...kept].sort((a, b) => a.start - b.start || rank(a) - rank(b) || b.end - a.end);
  const result: RegionProposal[] = [];
  for (const p of sorted) {
    const last = result[result.length - 1];
    if (last && p.start <= last.end) {
      if (p.end <= last.end) continue;
      result.push({ ...p, start: last.end + 1 });
    } else result.push(p);
  }
  return result;
}

/**
 * The length of every `RST` whose custom decoding takes inline bytes (an EXOS call's function code,
 * the 48K's report code and calculator literals), for the walk: the instruction and the data rows the
 * page's decoder puts after it.
 */
async function customLengths(image: BinaryImage, bankId: string): Promise<Map<number, number>> {
  const bank = imageBank(image, bankId);
  const lengths = new Map<number, number>();
  if (!image.romKind) return lengths;
  const memory = new Uint8Array(bank.origin + bank.bytes.length);
  memory.set(bank.bytes, bank.origin);
  for (let offset = 0; offset < bank.bytes.length; offset++) {
    if ((bank.bytes[offset] & 0xc7) !== 0xc7) continue;
    const start = bank.origin + offset;
    const end = Math.min(bank.origin + bank.bytes.length - 1, start + 96);
    const disassembler = new Z80Disassembler([new MemorySection(start, end, MemorySectionType.Disassemble)], memory, undefined, {
      allowExtendedSet: image.cpu === "z80n"
    });
    prepareRomDisassembler(disassembler, image.romKind);
    const items = ((await disassembler.disassemble(start, end))?.outputItems ?? []).filter((i) => !i.isPrefixItem);
    let next = 1;
    while (next < items.length && (!items[next].opCodes?.length || (items[next].instruction ?? "").startsWith("."))) next++;
    if (next > 1 && next < items.length) lengths.set(offset, items[next].address - start);
  }
  return lengths;
}

function hex(value: number): string {
  return value.toString(16).padStart(4, "0").toUpperCase();
}

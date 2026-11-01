import { MemorySectionType } from "@abstractions/MemorySection";
import { prepareRomDisassembler } from "@renderer/appIde/annotations/romDecoder";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import type { DisassemblyBranchCondition, DisassemblyBranchKind } from "@renderer/appIde/disassemblers/common-types";
import { imageBank, type BinaryImage } from "../image/binaryImage";
import { instructionEffects, type Effects } from "./effects";

/*
 * Stage 3's decoding (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.1): a bank's code regions through
 * Klive's own disassembler, with the image's CPU (D2) and the ROM kind's custom decoding, decoded the
 * way the level check decodes them: linearly from each region start and from each label (a label is
 * on an instruction start, so it is where a decode that slipped over data resynchronises).
 *
 * Every row carries its effects (`effects.ts`) and its branch, with the target as a bank offset when it
 * is inside the bank. Data rows a custom decoder emits inside code (the byte after an EXOS call) are
 * kept, marked `data`, so the flow can step over them.
 */

export type DecodedBranch = {
  kind: DisassemblyBranchKind;
  condition?: DisassemblyBranchCondition;
  /** The target as a bank offset, when the instruction names one inside the bank. */
  target?: number;
  /** The target's CPU address, when the instruction names one (inside the bank or not). */
  address?: number;
  /** `JP (HL)`, `JP (IX)`, `JP (C)`, `RET`: where an unnamed target comes from. */
  targetSource?: string;
};

export type DecodedRow = {
  offset: number;
  length: number;
  bytes: number[];
  /** The disassembler's text with generated labels (`L1234`) turned back into numbers. */
  text: string;
  /** The custom decoder's comment (an EXOS call's name). */
  comment?: string;
  /** Inline data a custom decoder emitted inside code. */
  data: boolean;
  branch?: DecodedBranch;
  effects: Effects;
};

export type DecodedBank = {
  bankId: string;
  origin: number;
  size: number;
  /** Every row of the code regions, in offset order. */
  rows: DecodedRow[];
  /** The row starting at an offset. */
  at: Map<number, DecodedRow>;
  /**
   * Hidden entries: rows decoded from a target that lands inside another instruction (`LD DE,$xx2E`
   * hiding `LD L,n`), up to where that decode meets the main rows again.
   */
  hidden: Map<number, DecodedRow>;
  /** The code regions decoded (bank offsets, inclusive). */
  code: { start: number; end: number }[];
};

export type DecodeOptions = {
  /** The bank's regions; the whole bank is code when absent. */
  regions?: readonly { start: number; end: number; type: string }[];
  /** Offsets the decode restarts at (labels). */
  cuts?: readonly number[];
};

export async function decodeBank(image: BinaryImage, bankId: string, options: DecodeOptions = {}): Promise<DecodedBank> {
  const bank = imageBank(image, bankId);
  const size = bank.bytes.length;
  const { origin } = bank;
  const code = (options.regions?.length ? options.regions : [{ start: 0, end: size - 1, type: "disassemble" }])
    .filter((r) => r.type === "disassemble" && r.start < size)
    .map((r) => ({ start: r.start, end: Math.min(r.end, size - 1) }))
    .sort((a, b) => a.start - b.start);
  const cuts = [...new Set(options.cuts ?? [])].sort((a, b) => a - b);

  const sections: MemorySection[] = [];
  for (const region of code) {
    const starts = [region.start, ...cuts.filter((c) => c > region.start && c <= region.end)];
    starts.forEach((start, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] - 1 : region.end;
      sections.push(new MemorySection(origin + start, origin + end, MemorySectionType.Disassemble));
    });
  }

  const rows: DecodedRow[] = [];
  if (sections.length) {
    const memory = new Uint8Array(origin + size);
    memory.set(bank.bytes, origin);
    const disassembler = new Z80Disassembler(sections, memory, undefined, { allowExtendedSet: image.cpu === "z80n" });
    prepareRomDisassembler(disassembler, image.romKind);
    const first = sections[0].startAddress;
    const last = sections[sections.length - 1].endAddress;
    const items = ((await disassembler.disassemble(first, last))?.outputItems ?? []).filter((item) => !item.isPrefixItem);
    items.forEach((item, i) => {
      const offset = item.address - origin;
      if (offset < 0 || offset >= size) return;
      const text = (item.instruction ?? "").replace(/\bL([0-9A-F]{4})\b/g, "$$$1");
      const data = text.startsWith(".") || !item.opCodes?.length;
      const nextAddress = i + 1 < items.length ? items[i + 1].address : origin + size;
      const length = !data && item.opCodes?.length ? item.opCodes.length : Math.max(1, nextAddress - item.address);
      const bytes = Array.from(bank.bytes.subarray(offset, Math.min(size, offset + length)));
      const branch = item.branch
        ? {
            kind: item.branch.kind,
            ...(item.branch.condition ? { condition: item.branch.condition } : {}),
            ...(item.branch.target !== undefined ? { address: item.branch.target } : {}),
            ...(item.branch.target !== undefined && item.branch.target >= origin && item.branch.target < origin + size
              ? { target: item.branch.target - origin }
              : {}),
            ...(item.branch.targetSource ? { targetSource: item.branch.targetSource } : {})
          }
        : undefined;
      rows.push({
        offset,
        length,
        bytes,
        text,
        ...(item.hardComment ? { comment: item.hardComment } : {}),
        data,
        ...(branch ? { branch } : {}),
        effects: data ? { reads: [], writes: [] } : instructionEffects(text, bytes)
      });
    });
  }
  rows.sort((a, b) => a.offset - b.offset);
  const at = new Map(rows.map((r) => [r.offset, r]));
  const decoded: DecodedBank = { bankId, origin, size, rows, at, hidden: new Map(), code };
  await decodeHiddenEntries(decoded, image, bank.bytes);
  return decoded;
}

/** The row at an offset: a main row, else a hidden entry's row. */
export function rowAt(decoded: DecodedBank, offset: number): DecodedRow | undefined {
  return decoded.at.get(offset) ?? decoded.hidden.get(offset);
}

/** The most rows a hidden entry is followed for before it must have met the main rows. */
const HIDDEN_LIMIT = 16;

/**
 * Decodes every branch target that lands inside an instruction of the code, from that target, until
 * the decode meets a main row (the two streams are in step again) or stops (a jump, a return).
 */
async function decodeHiddenEntries(decoded: DecodedBank, image: BinaryImage, bytes: Uint8Array): Promise<void> {
  const inCode = (offset: number) => decoded.code.some((r) => offset >= r.start && offset <= r.end);
  const pending = decoded.rows
    .map((r) => r.branch?.target)
    .filter((t): t is number => t !== undefined && !decoded.at.has(t) && inCode(t));
  const seen = new Set<number>();
  while (pending.length) {
    const start = pending.pop()!;
    if (seen.has(start) || decoded.at.has(start) || decoded.hidden.has(start)) continue;
    seen.add(start);
    const region = decoded.code.find((r) => start >= r.start && start <= r.end)!;
    const end = Math.min(region.end, start + HIDDEN_LIMIT * 4);
    const memory = new Uint8Array(decoded.origin + decoded.size);
    memory.set(bytes, decoded.origin);
    const disassembler = new Z80Disassembler(
      [new MemorySection(decoded.origin + start, decoded.origin + end, MemorySectionType.Disassemble)],
      memory,
      undefined,
      { allowExtendedSet: image.cpu === "z80n" }
    );
    prepareRomDisassembler(disassembler, image.romKind);
    const items = ((await disassembler.disassemble(decoded.origin + start, decoded.origin + end))?.outputItems ?? []).filter(
      (item) => !item.isPrefixItem
    );
    for (const item of items.slice(0, HIDDEN_LIMIT)) {
      const offset = item.address - decoded.origin;
      if (decoded.at.has(offset)) break;
      const text = (item.instruction ?? "").replace(/\bL([0-9A-F]{4})\b/g, "$$$1");
      const length = item.opCodes?.length || 1;
      const rowBytes = Array.from(bytes.subarray(offset, offset + length));
      const branch = item.branch
        ? {
            kind: item.branch.kind,
            ...(item.branch.condition ? { condition: item.branch.condition } : {}),
            ...(item.branch.target !== undefined ? { address: item.branch.target } : {}),
            ...(item.branch.target !== undefined && item.branch.target >= decoded.origin && item.branch.target < decoded.origin + decoded.size
              ? { target: item.branch.target - decoded.origin }
              : {}),
            ...(item.branch.targetSource ? { targetSource: item.branch.targetSource } : {})
          }
        : undefined;
      const data = text.startsWith(".") || !item.opCodes?.length;
      decoded.hidden.set(offset, {
        offset,
        length,
        bytes: rowBytes,
        text,
        ...(item.hardComment ? { comment: item.hardComment } : {}),
        data,
        ...(branch ? { branch } : {}),
        effects: data ? { reads: [], writes: [] } : instructionEffects(text, rowBytes)
      });
      if (branch?.target !== undefined && !decoded.at.has(branch.target)) pending.push(branch.target);
      if (branch && !branch.condition && (branch.kind === "jp" || branch.kind === "jr" || branch.kind === "ret" || branch.kind === "jp-indirect")) break;
    }
  }
}

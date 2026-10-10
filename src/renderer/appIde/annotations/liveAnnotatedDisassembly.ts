import type {
  DisassemblyItem,
  DisassemblyOperandLabelResolver
} from "@renderer/appIde/disassemblers/common-types";
import type { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import type { BankSpace, MemorySite, SlotPaging } from "@common/annotations/bankSpace";

import { createAnnotatedDisassemblyItems } from "./annotatedDisassembly";
import { ANNOTATION_BANK_SIZE } from "./programAnnotations";
import type { AddressSymbols, AnnotatedSite, SymbolHit } from "./symbolResolver";

/*
 * The live Disassembly view as an annotated listing
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.5).
 *
 * The view disassembles a Z80 address range, but annotations live in banks and ROM pages, and one
 * visible 64K window can cross four slots each holding a different bank, and possibly a ROM (T8).
 * So the range is split where the memory behind it changes, each piece is listed from its own
 * bank's regions (or its ROM page's), and the pieces are joined. A piece with nothing annotated
 * keeps the plain listing, which is what makes this cost nothing on a machine with no annotations.
 *
 * Row labels then come from the shared resolver, so a build symbol, an annotation label and a ROM
 * label all show in the one column, in the precedence of A8.
 */

/** A stretch of addresses backed by one bank or ROM page, its offsets running on. */
export type LivePiece = { start: number; end: number; site: MemorySite };

/** The granularity pieces are found at: fine enough for the ZX80/ZX81 1K mirrors. */
const PIECE_STEP = 0x0400;

/**
 * Split an address range where the memory behind it stops running on: another bank or ROM page, a
 * jump in offset (a mirror, a bank half paged elsewhere), or memory that cannot be annotated.
 */
export function livePieces(
  start: number,
  end: number,
  space: BankSpace,
  slots: SlotPaging
): LivePiece[] {
  const pieces: LivePiece[] = [];
  let address = start;
  while (address <= end) {
    const chunkEnd = Math.min(end, (Math.floor(address / PIECE_STEP) + 1) * PIECE_STEP - 1);
    const site = space.siteAt(address, slots);
    const previous = pieces[pieces.length - 1];
    if (site && previous && continues(previous, site, address)) {
      previous.end = chunkEnd;
    } else if (site) {
      pieces.push({ start: address, end: chunkEnd, site });
    }
    address = chunkEnd + 1;
  }
  return pieces;
}

function continues(previous: LivePiece, site: MemorySite, address: number): boolean {
  const prev = previous.site;
  if (prev.kind !== site.kind) return false;
  if (prev.kind === "bank" && site.kind === "bank" && prev.bank !== site.bank) return false;
  if (prev.kind === "rom" && site.kind === "rom" && prev.partition !== site.partition) return false;
  return site.offset === prev.offset + (address - previous.start);
}

/** The site a whole partition view shows (the panel's bank view), with its first offset. */
export function partitionSite(partition: number, space: BankSpace): MemorySite | undefined {
  if (partition < 0) return { kind: "rom", partition, offset: 0 };
  if (space.id === "next") return { kind: "bank", bank: partition >> 1, offset: (partition & 1) * 0x2000 };
  return { kind: "bank", bank: partition, offset: 0 };
}

export type LiveAnnotationOptions = {
  /** The plain listing, generated as before. */
  items: DisassemblyItem[];
  /** The memory the plain listing was generated from. */
  memory: Uint8Array;
  /** The address `memory[0]` is listed at: 0 for the 64K view, the bank's listing offset otherwise. */
  memoryBase: number;
  /** The address ranges disassembled as code, as `[start, end]`. Data sections are left alone. */
  ranges: readonly [number, number][];
  /** The pieces to annotate; derived from the ranges and the paging when absent. */
  pieces?: readonly LivePiece[];
  space: BankSpace;
  slots: SlotPaging;
  symbols: AddressSymbols;
  decimalView: boolean;
  /** The program counter, when paused: runs are cut at it (`pcAnchoredRuns`). */
  pc?: number;
  allowExtendedSet: boolean;
  prepareDisassembler?: (disassembler: Z80Disassembler) => void;
  /** Names for operands the annotations cannot give: build symbols, ROM labels, system variables. */
  fallbackOperandLabelResolver?: DisassemblyOperandLabelResolver;
  charSet?: (code: number) => string | undefined;
};

/** The row label for an address: the resolver's first name, the rest as alternatives. */
export function rowLabelOf(
  symbols: AddressSymbols,
  slots: SlotPaging,
  address: number
): {
  name: string;
  origin?: string;
  source?: "build" | "annotation" | "rom";
  alternatives?: string[];
  mirrorOf?: number;
} | undefined {
  const hits = symbols.allAt(address, slots);
  if (hits.length === 0) return undefined;
  const [first, ...rest] = hits;
  return {
    name: first.name,
    origin: describeOrigin(first),
    ...(first.source !== "sysvar" ? { source: first.source } : {}),
    ...(rest.length ? { alternatives: rest.map((hit) => `${hit.name} (${describeOrigin(hit)})`) } : {}),
    ...(first.mirrorOf !== undefined ? { mirrorOf: first.mirrorOf } : {})
  };
}

function describeOrigin(hit: SymbolHit): string {
  return hit.origin;
}

/**
 * Turn the plain live listing into the annotated one: annotated pieces re-listed from their
 * regions, every row labelled through the resolver.
 */
export async function annotateLiveListing(options: LiveAnnotationOptions): Promise<DisassemblyItem[]> {
  const { symbols, slots, space } = options;
  if (symbols.empty) return options.items;

  const pieces =
    options.pieces ??
    options.ranges.flatMap(([start, end]) => livePieces(start, end, space, slots));

  let items = options.items;
  for (const piece of pieces) {
    const annotated = symbols.annotatedSiteAt(piece.site);
    if (!annotated) continue;
    const listed = await listPiece(piece, annotated, options);
    if (!listed) continue;
    items = replaceRange(items, piece.start, piece.end, listed);
  }

  // --- Every row the pieces did not re-list takes its label from the resolver
  for (const item of items) {
    if (item.annotation || item.isPrefixItem) continue;
    const label = rowLabelOf(symbols, slots, item.address);
    if (!label) continue;
    item.hasLabel = true;
    item.formattedLabel = label.name;
    item.labelOrigin = label.origin;
    if (label.source) item.labelSource = label.source;
    if (label.alternatives) item.labelAlternatives = label.alternatives;
    if (label.mirrorOf !== undefined) markMirror(item, label.mirrorOf);
  }
  return items;
}

async function listPiece(
  piece: LivePiece,
  annotated: AnnotatedSite,
  options: LiveAnnotationOptions
): Promise<DisassemblyItem[] | undefined> {
  const length = piece.end - piece.start + 1;
  const firstOffset = piece.site.offset;
  // --- The bank's bytes at their own offsets: only the piece's are read
  const image = new Uint8Array(ANNOTATION_BANK_SIZE);
  const from = piece.start - options.memoryBase;
  if (from < 0 || from + length > options.memory.length) return undefined;
  image.set(options.memory.subarray(from, from + length), firstOffset);

  const pc = options.pc;
  const listed = await createAnnotatedDisassemblyItems({
    annotations: annotated.annotations,
    bank: annotated.bank,
    contents: image,
    decimalView: options.decimalView,
    disassOffset: piece.start - firstOffset,
    pcBankOffset:
      pc !== undefined && pc >= piece.start && pc <= piece.end ? firstOffset + (pc - piece.start) : undefined,
    fallbackOperandLabelResolver: options.fallbackOperandLabelResolver,
    range: { start: firstOffset, end: firstOffset + length - 1 },
    allowExtendedSet: options.allowExtendedSet,
    prepareDisassembler: options.prepareDisassembler,
    rowLabel: (address) => rowLabelOf(options.symbols, options.slots, address),
    charSet: options.charSet
  });
  if (!listed) return undefined;

  // --- Rows remember where edits to them go (§4.5): the bank site, or the ROM page's user layer
  for (const item of listed) {
    if (item.annotation) {
      item.annotation.bank = annotated.bank;
      item.annotation.site = annotated.kind;
      if (annotated.kind === "rom") item.annotation.partition = annotated.partition;
    }
    const label = item.isPrefixItem ? undefined : rowLabelOf(options.symbols, options.slots, item.address);
    if (label?.mirrorOf !== undefined) markMirror(item, label.mirrorOf);
    if (label?.source && item.formattedLabel === label.name) item.labelSource = label.source;
  }
  return listed;
}

/**
 * A ZX80/ZX81 mirror row (§4.7): it repeats the label of the canonical address, and says so in its
 * comment column when it has nothing else to say there — "(mirror of $4082)".
 */
function markMirror(item: DisassemblyItem, canonical: number): void {
  item.mirrorOf = canonical;
  if (!item.hardComment) {
    item.hardComment = `(mirror of $${canonical.toString(16).toUpperCase().padStart(4, "0")})`;
  }
}

/** Replace the rows in `[start, end]` with `replacement`, keeping the order by address. */
function replaceRange(
  items: DisassemblyItem[],
  start: number,
  end: number,
  replacement: DisassemblyItem[]
): DisassemblyItem[] {
  const before = items.filter((item) => item.address < start);
  const after = items.filter((item) => item.address > end);
  return [...before, ...replacement, ...after];
}

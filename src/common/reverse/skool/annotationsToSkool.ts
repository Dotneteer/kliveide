import type { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import type {
  AnnotationRegionType,
  BankAnnotation,
  BankGraphic,
  ProgramAnnotations,
  SkoolInterop
} from "@renderer/appIde/annotations/programAnnotations";

import { createAnnotatedDisassemblyItems } from "@renderer/appIde/annotations/annotatedDisassembly";
import { bankGraphicLength, getBankAnnotation } from "@renderer/appIde/annotations/programAnnotations";
import { describeNonCanonical, nonCanonicalReason } from "../canonicalEncoding";
import { REGION_BLOCK } from "./skoolToAnnotations";
import type { SkoolBlockType } from "./skoolTypes";

/*
 * Klive annotations as a SkoolKit skool or control file (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`
 * §6.3, §6.5, §6.6, phase S3). Written from SkoolKit's documented formats only (R7).
 *
 * It walks the same annotated listing source export walks (§7.2), with the names taken out of the
 * operands: SkoolKit's conventional style is upper case, `$` hex and numeric operands, with
 * `@label=` lines for names, which `skool2asm` substitutes itself (S8). Klive's custom decodings
 * (RST 08/28 inline bytes, Copper, DMA) and encodings the assembler would not reproduce are
 * `DEFB` with a comment.
 *
 * Entries (S2): a bank imported from a skool file has its entries in the passthrough, and is
 * written back with exactly those; otherwise a new entry starts at every region boundary and at
 * every address with a synopsis. A synopsis splits back into title, description, registers and
 * start comment — by the shape the passthrough recorded, or else by its paragraphs: the first is the
 * title, one whose lines all start `Input:`/`Output:`/`I:`/`O:` is the registers.
 *
 * A named graphic (§5.5) becomes a `b` entry whose description carries a `#UDGARRAY` macro.
 */

export type SkoolExportOptions = {
  annotations: ProgramAnnotations;
  bank: number;
  bytes: Uint8Array;
  listingBase: number;
  range?: { start: number; end: number };
  z80n: boolean;
  format: "skool" | "ctl";
  /** Write `@org` before the first entry (a 48K file, the first section of a 128K one). */
  org?: boolean;
  /** Write `@bank=n` before the first entry: a 128K section switched in at `$C000`. */
  bankDirective?: number;
  /** Non-entry comment lines at the top: a Next bank's name (Q6). */
  header?: string[];
  prepareDisassembler?: (disassembler: Z80Disassembler) => void;
};

type Row = {
  offset: number;
  length: number;
  type: AnnotationRegionType;
  /** SkoolKit-style instruction text. */
  text: string;
  /** The comment Klive generated (a decoding), used when the user wrote none. */
  generated?: string;
};

const REGISTER_LINE = /^(Input:|Output:|I:|O:)/;

export async function annotationsToSkool(options: SkoolExportOptions): Promise<string> {
  const bank = getBankAnnotation(options.annotations, options.bank);
  if (!bank) return "";
  const interop: SkoolInterop = bank.interop?.skool ?? {};
  const start = options.range?.start ?? 0;
  const end = options.range?.end ?? options.bytes.length - 1;

  // --- Where entries start: the passthrough's, or every region boundary, synopsis and graphic
  const starts = new Set<number>([start]);
  if (interop.entries) {
    for (const key of Object.keys(interop.entries)) starts.add(Number(key));
  } else {
    for (const region of bank.regions) starts.add(region.start);
    for (const [key, line] of Object.entries(bank.lineAnnotations ?? {})) if (line.synopsis) starts.add(Number(key));
    for (const graphic of bank.graphics ?? []) starts.add(graphic.offset);
  }
  // --- Rows are cut wherever something is said about an address, so a comment keeps its row
  const cuts = new Set<number>(starts);
  for (const key of Object.keys(bank.lineAnnotations ?? {})) cuts.add(Number(key));
  const rows = await listingRows(options, bank, start, end, cuts);
  const hexAddresses = !!interop.hex;
  const address = (offset: number) => {
    const value = (options.listingBase + offset) & 0xffff;
    return hexAddresses ? `$${value.toString(16).toUpperCase().padStart(4, "0")}` : String(value);
  };
  const labelAt = labelsByOffset(options.annotations, bank, options.listingBase);


  const entries: Row[][] = [];
  for (const row of rows) {
    if (starts.has(row.offset) || entries.length === 0) entries.push([]);
    entries[entries.length - 1].push(row);
  }

  const out: string[] = [];
  if (options.header?.length) {
    out.push(...options.header.map((line) => (options.format === "ctl" ? `# ${line}` : `; ${line}`)), "");
  }
  entries.forEach((entryRows, index) => {
    const first = entryRows[0];
    const key = String(first.offset);
    const graphic = bank.graphics?.find((g) => g.offset === first.offset);
    const header = splitSynopsis(bank, first.offset, interop, graphic, options.listingBase);
    const blockChar = (interop.blocks?.[key] as SkoolBlockType | undefined) ?? REGION_BLOCK[first.type] ?? "b";
    const directives = [
      ...(index === 0 && options.org && !hasDirective(interop, key, "org") ? [`org=${address(first.offset)}`] : []),
      ...(index === 0 && options.bankDirective !== undefined ? [`bank=${options.bankDirective}`] : []),
      ...(interop.entryDirectives?.[key] ?? [])
    ];
    const nonEntry = interop.nonEntry?.[key];
    if (options.format === "ctl") {
      writeCtlEntry(out, { entryRows, blockChar, header, directives, nonEntry, address, labelAt, bank, interop });
    } else {
      writeSkoolEntry(out, { entryRows, blockChar, header, directives, nonEntry, address, labelAt, bank, interop });
    }
  });
  const trailing = interop.nonEntry?.["16384"];
  if (trailing?.length && options.format === "skool") out.push(...trailing, "");
  while (out.length && out[out.length - 1] === "") out.pop();
  return `${out.join("\n")}\n`;
}

type EntryArgs = {
  entryRows: Row[];
  blockChar: SkoolBlockType;
  header: ReturnType<typeof splitSynopsis>;
  directives: string[];
  nonEntry?: string[];
  address: (offset: number) => string;
  labelAt: Map<number, string>;
  bank: BankAnnotation;
  interop: SkoolInterop;
};

function writeSkoolEntry(out: string[], args: EntryArgs): void {
  const { entryRows, header, interop, bank } = args;
  if (args.nonEntry?.length) {
    out.push(...args.nonEntry.filter((l) => !l.startsWith(">")), "");
  }
  for (const directive of args.directives) out.push(`@${directive}`);
  const sections = [
    header.title ? [header.title] : [],
    paragraphLines(header.description),
    header.registers,
    paragraphLines(header.start)
  ];
  let lastSection = sections.length - 1;
  while (lastSection >= 0 && sections[lastSection].length === 0) lastSection--;
  for (let i = 0; i <= lastSection; i++) {
    if (i > 0) out.push(";");
    for (const line of sections[i]) out.push(line === "." ? "; ." : `; ${line}`);
  }
  const braceEnds = new Map<number, number>();
  for (const [from, to] of Object.entries(interop.braces ?? {})) braceEnds.set(Number(from), to);
  let openBraceUntil: number | undefined;
  entryRows.forEach((row, index) => {
    const key = String(row.offset);
    const line = bank.lineAnnotations?.[key];
    if (index > 0 && line?.synopsis) {
      for (const text of paragraphLines(line.synopsis.split(/\n\s*\n/))) out.push(text === "." ? "; ." : `; ${text}`);
    }
    const label = args.labelAt.get(row.offset);
    if (label) out.push(`@label=${label}`);
    for (const directive of interop.directives?.[key] ?? []) out.push(`@${directive}`);
    if (row.type === "skip") {
      out.push(`i${args.address(row.offset)}`);
      out.push(...(interop.ignored?.[String(entryRows[0].offset)] ?? []));
      return;
    }
    const marker =
      index === 0 ? args.blockChar : interop.entryPoints?.includes(row.offset) || (!interop.entries && label) ? "*" : " ";
    let comment = line?.comment ?? row.generated;
    if (braceEnds.has(row.offset)) {
      openBraceUntil = braceEnds.get(row.offset);
      comment = `{${comment ?? ""}`;
      if (openBraceUntil === row.offset) {
        comment += "}";
        openBraceUntil = undefined;
      }
    } else if (openBraceUntil !== undefined && row.offset >= openBraceUntil) {
      comment = "}";
      openBraceUntil = undefined;
    } else if (openBraceUntil !== undefined) {
      comment = undefined;
    }
    const body = `${marker}${args.address(row.offset)} ${row.text}`;
    out.push(comment ? `${body.padEnd(25)} ; ${comment}` : body);
    if (line?.endComment) {
      for (const text of paragraphLines(line.endComment.split(/\n\s*\n/))) out.push(text === "." ? "; ." : `; ${text}`);
    }
  });
  out.push("");
}

function writeCtlEntry(out: string[], args: EntryArgs): void {
  const { entryRows, header, interop, bank, address } = args;
  const first = entryRows[0];
  const at = address(first.offset);
  for (const line of args.nonEntry ?? []) {
    out.push(line.startsWith(">") ? `> ${at},1 ${line.slice(1)}` : `> ${at} ${line}`);
  }
  for (const directive of args.directives) out.push(`@ ${at} ${directive}`);
  out.push(`${args.blockChar} ${at}${header.title ? ` ${header.title}` : ""}`);
  for (const paragraph of header.description) out.push(`D ${at} ${paragraph}`);
  for (const register of header.registers) out.push(`R ${at} ${register}`);
  for (const paragraph of header.start) out.push(`N ${at} ${paragraph}`);
  const natural = (blockOfRegion(first.type) ?? args.blockChar).toUpperCase();
  let previousType: string | undefined = args.blockChar === "i" ? "I" : natural;
  entryRows.forEach((row, index) => {
    const key = String(row.offset);
    const line = bank.lineAnnotations?.[key];
    const label = args.labelAt.get(row.offset);
    if (label) out.push(`@ ${address(row.offset)} label=${label}`);
    for (const directive of interop.directives?.[key] ?? []) out.push(`@ ${address(row.offset)} ${directive}`);
    if (index > 0 && line?.synopsis) {
      for (const paragraph of line.synopsis.split(/\n\s*\n/)) out.push(`N ${address(row.offset)} ${paragraph.replace(/\n/g, " ")}`);
    }
    if (row.type === "skip") return;
    const sub = (blockOfRegion(row.type) ?? "b").toUpperCase();
    const comment = line?.comment ?? row.generated;
    if (sub !== previousType || comment) {
      out.push(`${sub} ${address(row.offset)},${row.length}${comment ? ` ${comment}` : ""}`);
      previousType = comment ? undefined : sub;
    }
    if (line?.endComment) {
      for (const paragraph of line.endComment.split(/\n\s*\n/)) out.push(`E ${at} ${paragraph.replace(/\n/g, " ")}`);
    }
  });
  out.push("");
}

function blockOfRegion(type: AnnotationRegionType): SkoolBlockType | undefined {
  return REGION_BLOCK[type];
}

function hasDirective(interop: SkoolInterop, key: string, name: string): boolean {
  return (interop.entryDirectives?.[key] ?? []).some((d) => d === name || d.startsWith(`${name}=`));
}

/** Paragraphs as comment lines, a `.` line between two. */
function paragraphLines(paragraphs: string[]): string[] {
  const lines: string[] = [];
  paragraphs.forEach((paragraph, index) => {
    if (index > 0) lines.push(".");
    lines.push(...paragraph.split("\n"));
  });
  return lines;
}

/** An entry's synopsis as SkoolKit's header sections. */
function splitSynopsis(
  bank: BankAnnotation,
  offset: number,
  interop: SkoolInterop,
  graphic: BankGraphic | undefined,
  listingBase: number
): { title?: string; description: string[]; registers: string[]; start: string[] } {
  const synopsis = bank.lineAnnotations?.[String(offset)]?.synopsis;
  const paragraphs = synopsis ? synopsis.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];
  const shape = interop.entries?.[String(offset)];
  let result: { title?: string; description: string[]; registers: string[]; start: string[] };
  const expected = shape ? (shape.title ? 1 : 0) + shape.desc + (shape.regs ? 1 : 0) + shape.start : -1;
  if (shape && expected === paragraphs.length) {
    let i = 0;
    const title = shape.title ? paragraphs[i++] : undefined;
    const description = paragraphs.slice(i, (i += shape.desc));
    const registers = shape.regs ? paragraphs[i++].split("\n") : [];
    result = { title, description, registers, start: paragraphs.slice(i) };
  } else {
    const [title, ...rest] = paragraphs;
    const registerIndex = rest.findIndex((p) => p.split("\n").every((line) => REGISTER_LINE.test(line)));
    result =
      registerIndex < 0
        ? { title, description: rest.map((p) => p.replace(/\n/g, " ")), registers: [], start: [] }
        : {
            title,
            description: rest.slice(0, registerIndex).map((p) => p.replace(/\n/g, " ")),
            registers: rest[registerIndex].split("\n"),
            start: rest.slice(registerIndex + 1).map((p) => p.replace(/\n/g, " "))
          };
  }
  if (graphic) {
    result.title ??= graphic.label ?? "Graphic";
    result.description = [...result.description, udgArray(graphic, listingBase)];
  }
  return result;
}

/**
 * A `#UDGARRAY` macro that draws a named graphic in `skool2html` (§6.6): the 8×8 UDGs it is made of,
 * in reading order, from SkoolKit's documented macro syntax (generated text, R7).
 */
export function udgArray(graphic: BankGraphic, listingBase: number): string {
  const base = (listingBase + graphic.offset) & 0xffff;
  const name = graphic.label ?? `graphic${base.toString(16)}`;
  const length = bankGraphicLength(graphic);
  if (graphic.layout === "cells" || graphic.layout === "columns") {
    // --- Cells are UDGs already: consecutive 8-byte runs, `width` to a row
    return `#UDGARRAY${graphic.width};${base}-${base + length - 1}-8(${name})`;
  }
  // --- Row-major: a UDG's eight rows are `width` bytes apart; the next UDG one byte on
  const rowsOfCells = Math.max(1, Math.floor(graphic.height / 8)) * graphic.count;
  const cells: string[] = [];
  for (let row = 0; row < rowsOfCells; row++) {
    for (let col = 0; col < graphic.width; col++) cells.push(String(base + row * 8 * graphic.width + col));
  }
  return `#UDGARRAY${graphic.width},,,${graphic.width};${cells.join(";")}(${name})`;
}

/** Labels by bank offset: the bank's own, then the global ones that land in it. */
function labelsByOffset(annotations: ProgramAnnotations, bank: BankAnnotation, listingBase: number): Map<number, string> {
  const map = new Map<number, string>();
  for (const label of bank.localLabels ?? []) if (!map.has(label.value)) map.set(label.value, label.name);
  for (const label of annotations.globalLabels ?? []) {
    const offset = (label.value - listingBase) & 0xffff;
    if (offset < 0x4000 && !map.has(offset)) map.set(offset, label.name);
  }
  return map;
}

/** The listing's rows in SkoolKit's instruction style. */
async function listingRows(
  options: SkoolExportOptions,
  bank: BankAnnotation,
  start: number,
  end: number,
  cuts: Set<number>
): Promise<Row[]> {
  // --- Names out of the operands (S8): a copy with no labels and no operand references
  const unnamed: ProgramAnnotations = {
    ...options.annotations,
    globalLabels: [],
    banks: {
      ...options.annotations.banks,
      [String(options.bank)]: { ...bank, localLabels: undefined, operandReferences: undefined, lineAnnotations: undefined }
    }
  };
  // --- One listing per segment between cuts: a data row never runs across an entry start
  const boundaries = [...cuts].filter((c) => c > start && c <= end).sort((a, b) => a - b);
  const items = [];
  let segmentStart = start;
  for (const boundary of [...boundaries, end + 1]) {
    items.push(
      ...((await createAnnotatedDisassemblyItems({
        annotations: unnamed,
        bank: options.bank,
        contents: options.bytes,
        disassOffset: options.listingBase,
        range: { start: segmentStart, end: boundary - 1 },
        allowExtendedSet: options.z80n,
        prepareDisassembler: options.prepareDisassembler,
        noLabelPrefix: true
      })) ?? [])
    );
    segmentStart = boundary;
  }
  const rows: Row[] = [];
  let emittedUntil = start;
  for (const item of items) {
    if (item.isPrefixItem) continue;
    const offset = item.annotation?.bankOffset ?? 0;
    let length = item.annotation?.byteLength ?? item.opCodes?.length ?? 1;
    if (offset < emittedUntil) continue;
    const regionEnd = bank.regions.find((r) => offset >= r.start && offset <= r.end)?.end ?? end;
    length = Math.min(length, Math.min(regionEnd, end) - offset + 1);
    const type = item.annotation?.regionType ?? "disassemble";
    const bytes = Array.from(options.bytes.subarray(offset, offset + length));
    const instruction = item.instruction ?? "";
    let text: string;
    // --- Only a `DEFB` stand-in carries a comment of Klive's own (S8); a listing's other generated
    // --- notes (a byte picture, a register's name) would come back as the user's on import
    let generated: string | undefined;
    if (type === "skip") {
      text = "";
    } else if (type === "disassemble" && item.opCodes?.length && length === item.opCodes.length) {
      const reason = nonCanonicalReason(bytes, options.z80n);
      if (reason || !instruction || instruction.startsWith(".")) {
        text = defb(bytes);
        generated = `${instruction}${reason ? ` (${describeNonCanonical(reason)})` : ""}`;
      } else {
        text = upperOutsideStrings(instruction);
      }
    } else if (/^\.def[bwm]\b/i.test(instruction) && type !== "copper" && type !== "dma" && length === (item.annotation?.byteLength ?? length)) {
      text = upperOutsideStrings(instruction.replace(/^\.(def[bwm])/i, (_, d: string) => d.toUpperCase())).replace(/,\s+/g, ",");
    } else {
      text = defb(bytes);
      generated = instruction ? `${instruction}${item.hardComment ? ` ; ${item.hardComment}` : ""}` : undefined;
    }
    rows.push({ offset, length, type, text, generated });
    emittedUntil = offset + length;
  }
  return rows;
}

function defb(bytes: number[]): string {
  return `DEFB ${bytes.map((b) => `$${b.toString(16).toUpperCase().padStart(2, "0")}`).join(",")}`;
}

function upperOutsideStrings(text: string): string {
  return text
    .split(/("(?:[^"\\]|\\.)*")/)
    .map((part, i) => (i % 2 === 1 ? part : part.toUpperCase()))
    .join("");
}

import type { DisassemblyItem, DisassemblyOperandLabelResolver } from "@renderer/appIde/disassemblers/common-types";
import type { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import type { BankAnnotation, ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";

import { createAnnotatedDisassemblyItems } from "@renderer/appIde/annotations/annotatedDisassembly";
import { getBankAnnotation } from "@renderer/appIde/annotations/programAnnotations";
import { isZ80Keyword } from "@main/z80-compiler/z80-token-stream";
import { describeNonCanonical, nonCanonicalReason } from "./canonicalEncoding";

/*
 * Export an annotated region as source that reassembles to the same bytes
 * (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §7, G7.6).
 *
 * Pure. It walks the annotated listing (G7.1-A3) — the same rows the Disassembly view shows — and
 * turns each into a `SourceLine`; a dialect renders the lines (R11). On the way it makes every row
 * safe to assemble:
 *
 * - an encoding the assembler would not reproduce becomes `.defb` with the instruction as its
 *   comment (E-T1, `canonicalEncoding.ts`);
 * - an instruction that runs past its region becomes `.defb` of the bytes the region holds;
 * - a `skip` region becomes `.defb` data, or a new `.org` with `-skip gap` (E-T5);
 * - Copper and DMA rows become `.defb` with the decoding as the comment;
 * - a label the assembler would not accept, or two that differ only in case, is renamed (E-T2);
 * - a name used in an operand but defined outside the range becomes `NAME .equ $NNNN` (E-T3).
 *
 * The result is verified by assembling it (R10) — see `compareAssembly`.
 */

export type SourceLine =
  | { kind: "blank" }
  | { kind: "comment"; text: string }
  | { kind: "directive"; text: string; comment?: string }
  | { kind: "equ"; name: string; value: number }
  | { kind: "row"; label?: string; text: string; comment?: string };

/** How lines become text in one assembler's syntax (R11): Klive asm now, sjasmplus later (Q4). */
export interface SourceDialect {
  readonly id: string;
  readonly extension: string;
  render(lines: readonly SourceLine[]): string;
}

const hex2 = (n: number) => `$${n.toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;

export const kliveDialect: SourceDialect = {
  id: "klive",
  extension: ".kz80.asm",
  render(lines) {
    const out: string[] = [];
    for (const line of lines) {
      switch (line.kind) {
        case "blank":
          out.push("");
          break;
        case "comment":
          out.push(line.text ? `; ${line.text}` : ";");
          break;
        case "directive":
          out.push(`  ${line.text}${line.comment ? ` ; ${line.comment}` : ""}`);
          break;
        case "equ":
          out.push(`${line.name} .equ ${hex4(line.value)}`);
          break;
        case "row": {
          const label = line.label ? `${line.label}:` : "";
          const body = label.length >= 15 ? `${label}\n${" ".repeat(16)}${line.text}` : `${label.padEnd(16)}${line.text}`;
          out.push(line.comment ? `${body.padEnd(40)} ; ${line.comment}` : body.trimEnd());
          break;
        }
      }
    }
    return `${out.join("\n")}\n`;
  }
};

export type SourceExportOptions = {
  annotations: ProgramAnnotations;
  bank: number;
  /** The bank's 16K. */
  bytes: Uint8Array;
  /** The address bank offset 0 is listed (and assembled) at. */
  listingBase: number;
  /** Bank offsets to export, inclusive; the whole bank when absent. */
  range?: { start: number; end: number };
  z80n: boolean;
  /** `data` (default): a skip region's bytes as `.defb`; `gap`: a new `.org` past it. */
  skip?: "data" | "gap";
  /** `.model` to write (`Spectrum128`, `next`), when the bytes need one. */
  model?: string;
  /** `.bank n` to write before the code, on a 128K-family machine. */
  bankDirective?: number;
  /** Header comment lines: the host, the bank. */
  header?: string[];
  /** Names the annotations cannot give: ROM labels, system variables. Each one used is defined. */
  externalNames?: DisassemblyOperandLabelResolver;
  /** The machine's custom disassembler (RST 08/28 inline bytes on the 48K ROM). */
  prepareDisassembler?: (disassembler: Z80Disassembler) => void;
  charSet?: (code: number) => string | undefined;
};

export type SourceExportResult = {
  lines: SourceLine[];
  /** The bytes the export must assemble to, by address. */
  expected: { address: number; bytes: number[] }[];
  /** What was changed to make it assemble: renamed labels, `.defb` stand-ins, gaps. */
  notes: string[];
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Whether the assembler accepts a name as a label: an identifier that is not one of its keywords. */
export function isAssemblableName(name: string): boolean {
  return IDENTIFIER.test(name) && !isZ80Keyword(name);
}

export async function exportSource(options: SourceExportOptions): Promise<SourceExportResult> {
  const notes: string[] = [];
  // --- Names: the annotations' labels, made assemblable (E-T2) in a copy of the model, so the
  // --- listing writes the safe name wherever it writes the label — definitions and operands alike
  const annotations = withRenamedLabels(
    options.annotations,
    buildRenames(options.annotations, getBankAnnotation(options.annotations, options.bank), notes)
  );
  const bankAnnotation = getBankAnnotation(annotations, options.bank);
  const start = options.range?.start ?? 0;
  const end = options.range?.end ?? options.bytes.length - 1;

  // --- Every name an operand used that the walk did not define locally, with its value
  const usedExternal = new Map<string, number>();
  const externalResolver: DisassemblyOperandLabelResolver | undefined = options.externalNames
    ? (args) => {
        const name = options.externalNames!(args);
        if (name) usedExternal.set(name, args.operandValue & 0xffff);
        return name;
      }
    : undefined;

  const items =
    (await createAnnotatedDisassemblyItems({
      annotations,
      bank: options.bank,
      contents: options.bytes,
      decimalView: false,
      disassOffset: options.listingBase,
      range: { start, end },
      allowExtendedSet: options.z80n,
      prepareDisassembler: options.prepareDisassembler,
      fallbackOperandLabelResolver: externalResolver,
      charSet: options.charSet,
      noLabelPrefix: true
    })) ?? [];

  const regions = bankAnnotation?.regions ?? [{ start: 0, end: options.bytes.length - 1, type: "disassemble" as const }];
  const regionEndAt = (offset: number) => regions.find((r) => offset >= r.start && offset <= r.end)?.end ?? end;
  const regionTypeAt = (offset: number) => regions.find((r) => offset >= r.start && offset <= r.end)?.type;
  const addressOf = (offset: number) => (options.listingBase + offset) & 0xffff;

  const labelValues = labelValueMap(annotations, bankAnnotation, options.listingBase);

  const body: SourceLine[] = [];
  const expected: SourceExportResult["expected"] = [];
  let segment: { address: number; bytes: number[] } | undefined;
  const definedNames = new Set<string>();
  let emittedUntil = start;
  let pendingSynopsis: string[] = [];

  const emitBytes = (offset: number, bytes: number[]) => {
    if (!segment || segment.address + segment.bytes.length !== addressOf(offset)) {
      segment = { address: addressOf(offset), bytes: [] };
      expected.push(segment);
    }
    segment.bytes.push(...bytes);
  };
  const defbRows = (offset: number, bytes: number[], comment?: string, label?: string) => {
    for (let i = 0; i < bytes.length; i += 8) {
      const chunk = bytes.slice(i, i + 8);
      body.push({
        kind: "row",
        ...(i === 0 && label ? { label } : {}),
        text: `.defb ${chunk.map(hex2).join(",")}`,
        ...(i === 0 && comment ? { comment } : {})
      });
    }
    emitBytes(offset, bytes);
  };

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.isPrefixItem) {
      pendingSynopsis.push(item.prefixComment ?? "");
      continue;
    }
    const offset = item.annotation?.bankOffset ?? ((item.address - options.listingBase) & 0x3fff);
    let length = item.annotation?.byteLength ?? item.opCodes?.length ?? 1;
    // --- Bytes the listing skipped over (should not happen) are kept as data
    if (offset > emittedUntil) defbRows(emittedUntil, Array.from(options.bytes.subarray(emittedUntil, offset)), "not listed");
    for (const line of pendingSynopsis) body.push({ kind: "comment", text: line });
    pendingSynopsis = [];

    // --- Only a name the annotations gave: the disassembler's own `hasLabel` marks a jump target,
    // --- whose operands are written as numbers here (`noLabelPrefix`)
    const label = item.formattedLabel;
    if (label) definedNames.add(label.toLowerCase());
    const comment = item.hardComment || undefined;
    const type = item.annotation?.regionType ?? regionTypeAt(offset);

    // --- An instruction the previous row already covered (overlap at a PC cut): only its new bytes
    if (offset < emittedUntil) {
      const tail = offset + length - emittedUntil;
      if (tail > 0) defbRows(emittedUntil, Array.from(options.bytes.subarray(emittedUntil, offset + length)), `overlap: ${item.instruction}`);
      emittedUntil = Math.max(emittedUntil, offset + length);
      continue;
    }
    // --- An instruction that runs past its region holds only the region's bytes
    const regionEnd = Math.min(regionEndAt(offset), end);
    if (offset + length - 1 > regionEnd) {
      length = regionEnd - offset + 1;
      defbRows(offset, Array.from(options.bytes.subarray(offset, offset + length)), `${item.instruction} (runs past the region)`, label);
      emittedUntil = offset + length;
      pushEndComment(body, bankAnnotation, offset);
      continue;
    }
    const bytes = Array.from(options.bytes.subarray(offset, offset + length));
    const instruction = item.instruction ?? "";

    if (type === "skip") {
      if (options.skip === "gap") {
        body.push({ kind: "comment", text: `${hex4(addressOf(offset))}-${hex4(addressOf(offset + length - 1))}: ${length} byte(s) not exported` });
        body.push({ kind: "directive", text: `.org ${hex4(addressOf(offset + length) & 0xffff)}` });
        notes.push(`A skip region at ${hex4(addressOf(offset))} was left out (${length} bytes): the export reassembles to fewer bytes.`);
        segment = undefined;
      } else {
        defbRows(offset, bytes, comment ?? "skip region", label);
      }
    } else if (type === "disassemble" && item.opCodes?.length) {
      const reason = nonCanonicalReason(bytes, options.z80n);
      if (reason || !instruction || instruction.startsWith(".") && !/^\.def[bwm]\b/i.test(instruction)) {
        defbRows(offset, bytes, `${instruction || "?"}${reason ? ` (${describeNonCanonical(reason)})` : ""}`, label);
        if (reason) notes.push(`${hex4(addressOf(offset))}: ${instruction} is written as .defb (${describeNonCanonical(reason)}).`);
      } else {
        body.push({ kind: "row", ...(label ? { label } : {}), text: instruction, ...(comment ? { comment } : {}) });
        emitBytes(offset, bytes);
      }
    } else if (/^\.def[bwm]\b/i.test(instruction) && (type !== "copper" && type !== "dma")) {
      body.push({ kind: "row", ...(label ? { label } : {}), text: instruction, ...(comment ? { comment } : {}) });
      emitBytes(offset, bytes);
    } else {
      // --- Copper, DMA, and any row whose text is not plain data: its bytes, its text as the comment
      defbRows(offset, bytes, comment ? `${instruction} ; ${comment}` : instruction, label);
    }
    emittedUntil = offset + length;
    pushEndComment(body, bankAnnotation, offset);
  }
  if (emittedUntil <= end) defbRows(emittedUntil, Array.from(options.bytes.subarray(emittedUntil, end + 1)), "not listed");

  // --- Names used but not defined here: the annotations' own, and the external ones (E-T3)
  const equs: SourceLine[] = [];
  const equDone = new Set<string>();
  for (const line of body) {
    if (line.kind !== "row") continue;
    for (const word of line.text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
      const key = word.toLowerCase();
      if (definedNames.has(key) || equDone.has(key)) continue;
      const value = labelValues.get(word) ?? usedExternal.get(word);
      if (value === undefined) continue;
      equDone.add(key);
      equs.push({ kind: "equ", name: word, value });
    }
  }

  const lines: SourceLine[] = [];
  for (const text of options.header ?? []) lines.push({ kind: "comment", text });
  for (const text of (bankAnnotation?.comment ?? "").split("\n").filter((t) => t.trim())) lines.push({ kind: "comment", text });
  if (lines.length) lines.push({ kind: "blank" });
  if (options.model) lines.push({ kind: "directive", text: `.model ${options.model}` });
  if (equs.length) {
    lines.push(...equs.sort((a, b) => (a.kind === "equ" && b.kind === "equ" ? a.value - b.value : 0)));
    lines.push({ kind: "blank" });
  }
  if (options.bankDirective !== undefined) lines.push({ kind: "directive", text: `.bank ${options.bankDirective}` });
  lines.push({ kind: "directive", text: `.org ${hex4(addressOf(start))}` });
  lines.push(...body);
  return { lines, expected, notes };
}

function pushEndComment(body: SourceLine[], bank: BankAnnotation | undefined, offset: number): void {
  const endComment = bank?.lineAnnotations?.[String(offset)]?.endComment;
  if (!endComment) return;
  for (const text of endComment.split("\n")) body.push({ kind: "comment", text });
}

/** Every annotation label's value as an address under this listing, by name. */
function labelValueMap(
  annotations: ProgramAnnotations,
  bank: BankAnnotation | undefined,
  listingBase: number
): Map<string, number> {
  const map = new Map<string, number>();
  for (const label of annotations.globalLabels ?? []) map.set(label.name, label.value);
  for (const label of bank?.localLabels ?? []) map.set(label.name, (listingBase + label.value) & 0xffff);
  return map;
}

/**
 * The rename rule for the export (E-T2): a name the assembler rejects (a keyword, a bad character)
 * gets a `L_` prefix; a name that differs from an earlier one only in case gets `_2`, `_3`.
 */
function buildRenames(
  annotations: ProgramAnnotations,
  bank: BankAnnotation | undefined,
  notes: string[]
): Map<string, string> {
  const renames = new Map<string, string>();
  const taken = new Set<string>();
  const all = [...(annotations.globalLabels ?? []), ...(bank?.localLabels ?? [])].map((l) => l.name);
  for (const name of all) {
    if (renames.has(name)) continue;
    const base = isAssemblableName(name) ? name : `L_${name.replace(/[^A-Za-z0-9_]/g, "_")}`;
    let candidate = base;
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base}_${n}`;
    taken.add(candidate.toLowerCase());
    renames.set(name, candidate);
    if (candidate !== name) notes.push(`The label ${name} is exported as ${candidate}.`);
  }
  return renames;
}

/** A copy of the model with the labels renamed, operand references and graphics with them. */
function withRenamedLabels(annotations: ProgramAnnotations, renames: Map<string, string>): ProgramAnnotations {
  if ([...renames].every(([from, to]) => from === to)) return annotations;
  const name = (n: string) => renames.get(n) ?? n;
  const banks: Record<string, BankAnnotation> = {};
  for (const [key, bank] of Object.entries(annotations.banks)) {
    banks[key] = {
      ...bank,
      ...(bank.localLabels ? { localLabels: bank.localLabels.map((l) => ({ ...l, name: name(l.name) })) } : {}),
      ...(bank.operandReferences
        ? {
            operandReferences: Object.fromEntries(
              Object.entries(bank.operandReferences).map(([k, refs]) => [k, refs.map((r) => ({ ...r, name: name(r.name) }))])
            )
          }
        : {})
    };
  }
  return {
    ...annotations,
    ...(annotations.globalLabels ? { globalLabels: annotations.globalLabels.map((l) => ({ ...l, name: name(l.name) })) } : {}),
    banks
  };
}

/**
 * Compare assembled segments with the bytes they must reproduce: the first differing addresses, up
 * to `limit`, and whether the whole export is byte-identical.
 */
export function compareAssembly(
  expected: SourceExportResult["expected"],
  segments: readonly { startAddress: number; emittedCode: number[]; bank?: number }[],
  limit = 5
): { identical: boolean; differences: { address: number; expected?: number; actual?: number }[] } {
  const actual = new Map<number, number>();
  for (const segment of segments) {
    segment.emittedCode.forEach((byte, i) => actual.set((segment.startAddress + i) & 0xffff, byte));
  }
  const expectedMap = new Map<number, number>();
  for (const run of expected) run.bytes.forEach((byte, i) => expectedMap.set((run.address + i) & 0xffff, byte));
  const differences: { address: number; expected?: number; actual?: number }[] = [];
  const addresses = [...new Set([...expectedMap.keys(), ...actual.keys()])].sort((a, b) => a - b);
  for (const address of addresses) {
    const e = expectedMap.get(address);
    const a = actual.get(address);
    if (e !== a) {
      differences.push({ address, ...(e !== undefined ? { expected: e } : {}), ...(a !== undefined ? { actual: a } : {}) });
      if (differences.length >= limit) break;
    }
  }
  return { identical: differences.length === 0, differences };
}

/** The dialect by name; only Klive asm for now (Q4). */
export function dialectOf(id: string | undefined): SourceDialect | undefined {
  return !id || id === "klive" ? kliveDialect : undefined;
}

export type { DisassemblyItem };

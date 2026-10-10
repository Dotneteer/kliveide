import type {
  AnnotationRegionType,
  BankAnnotation,
  LineAnnotation,
  ProgramAnnotations,
  SkoolInterop
} from "@renderer/appIde/annotations/programAnnotations";
import { DEFAULT_REGION, isValidLabelName } from "@renderer/appIde/annotations/programAnnotations";
import type { ClassifiedRun, ProposedType } from "../classify";
import { applyProposals, proposeForBank, type BankProposal, type ProposalMode } from "../proposal";
import type { SkoolBlockType, SkoolDocument, SkoolEntry, SkoolInstruction } from "./skoolTypes";

/*
 * A SkoolKit skool or control file as Klive annotations (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`
 * §6.3, phase S2). Written from SkoolKit's documented formats only (R7).
 *
 * - **Bytes come from Klive (R9, S-T2).** The importer never builds memory from instruction text.
 *   Each skool instruction is assembled at its address and compared with the bytes Klive already
 *   has; an entry with a mismatch keeps its comments and labels but not its regions, and is listed.
 *   A control file has no instructions, so it is checked by length only.
 * - **Paging (S-T1).** Addresses are 16-bit; the caller resolves each one to a bank site under the
 *   paging the file implies, starting from the 48K map, with `@bank` switching the bank at `$C000`.
 * - **Entries (S2).** An entry is a label (from `@label`) and a synopsis on its first address: the
 *   title, the description paragraphs, the register lines, the start comment. How many paragraphs
 *   each section had is kept in the passthrough, so an unedited entry exports back as it came.
 * - **Comments (S3).** Instruction comments become end-of-line comments; a braced comment goes on
 *   its first instruction, its span kept in the passthrough; mid-block comments become the synopsis
 *   of the instruction they precede; end comments become `endComment` on the entry's last address.
 * - **The passthrough (S5)** keeps unknown `@` directives, non-entry text, braces, `*` marks and
 *   the block characters Klive does not model (`s`, `g`, `u`).
 * - **Skool macros stay verbatim (S6)** in Klive's comments.
 *
 * Normalisations (the round trip is identical modulo these): a register line without an `Input:`,
 * `Output:`, `I:` or `O:` prefix gets `I:`; a braced comment's text is joined onto its first
 * instruction.
 */

export type SkoolSite = { bank: number; offset: number; rom?: boolean };

export type SkoolImportInput = {
  doc: SkoolDocument;
  /** Where an address is, with the bank `@bank` paged at `$C000` (undefined: the default map). */
  siteOf(address: number, bankAtC000: number | undefined): SkoolSite | undefined;
  /** The 16K Klive has for a bank (or ROM page) a site is in. */
  bankBytes(site: SkoolSite): Promise<Uint8Array | undefined>;
  /** Assemble instructions, each at its address: its bytes, or why it does not assemble. */
  assemble(lines: { text: string; address: number }[]): Promise<({ bytes: number[] } | { error: string })[]>;
};

export type SkoolBankImport = {
  bank: number;
  rom: boolean;
  /** The regions to propose, bank-relative. */
  regions: { start: number; end: number; type: AnnotationRegionType }[];
  labels: { name: string; offset: number }[];
  lines: Record<string, LineAnnotation>;
  interop: SkoolInterop;
  entries: number;
  mismatchedEntries: number;
};

export type SkoolImportProblem = { line: number; message: string };

export type SkoolImportResult = {
  banks: SkoolBankImport[];
  problems: SkoolImportProblem[];
  renamed: { from: string; to: string }[];
};

const BLOCK_REGION: Record<SkoolBlockType, AnnotationRegionType> = {
  c: "disassemble",
  b: "bytes",
  w: "words",
  t: "text",
  s: "bytes",
  g: "bytes",
  u: "bytes",
  i: "skip"
};

/** The block character Klive writes for a region type (S1 the other way). */
export const REGION_BLOCK: Partial<Record<AnnotationRegionType, SkoolBlockType>> = {
  disassemble: "c",
  bytes: "b",
  words: "w",
  text: "t",
  skip: "i",
  graphic: "b",
  copper: "b",
  dma: "b"
};

const REGISTER_PREFIX = /^(Input:|Output:|I:|O:)/;

/** The region an instruction's own text implies: a `DEFx` directive's, or code. */
function instructionRegion(text: string, entryType: SkoolBlockType): AnnotationRegionType {
  const word = text.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  switch (word) {
    case "DEFB":
    case "DEFS":
      return "bytes";
    case "DEFW":
      return "words";
    case "DEFM":
      return "text";
    case "":
      return BLOCK_REGION[entryType];
    default:
      return entryType === "i" ? "skip" : "disassemble";
  }
}

/** Build the synopsis an entry's header becomes, and how its sections split back. */
export function entrySynopsis(entry: Pick<SkoolEntry, "title" | "description" | "registers" | "startComment">): {
  synopsis?: string;
  shape: { title: boolean; desc: number; regs: number; start: number };
} {
  const paragraphs: string[] = [];
  if (entry.title) paragraphs.push(entry.title);
  paragraphs.push(...entry.description);
  const registers = entry.registers.map((line) => (REGISTER_PREFIX.test(line) ? line : `I:${line}`));
  if (registers.length) paragraphs.push(registers.join("\n"));
  paragraphs.push(...entry.startComment);
  return {
    synopsis: paragraphs.length ? paragraphs.join("\n\n") : undefined,
    shape: {
      title: !!entry.title,
      desc: entry.description.length,
      regs: registers.length,
      start: entry.startComment.length
    }
  };
}

export async function skoolToAnnotations(input: SkoolImportInput): Promise<SkoolImportResult> {
  const { doc } = input;
  const problems: SkoolImportProblem[] = doc.diagnostics.map((d) => ({ line: d.line, message: d.message }));
  const renamed: { from: string; to: string }[] = [];
  const banks = new Map<string, SkoolBankImport>();
  const bankOf = (site: SkoolSite): SkoolBankImport => {
    const key = `${site.rom ? "rom" : "bank"}:${site.bank}`;
    let bank = banks.get(key);
    if (!bank) {
      bank = { bank: site.bank, rom: !!site.rom, regions: [], labels: [], lines: {}, interop: {}, entries: 0, mismatchedEntries: 0 };
      banks.set(key, bank);
    }
    return bank;
  };
  const takenNames = new Map<string, string>();

  // --- The paging each entry is read under: `@bank` switches the bank at $C000 from there on
  const directivesOf = (entry: SkoolEntry) => [...entry.directives, ...entry.instructions.flatMap((i) => i.directives)];
  const entryBank: (number | undefined)[] = [];
  let bankAtC000: number | undefined;
  for (const entry of doc.entries) {
    for (const directive of directivesOf(entry)) {
      if (directive.name === "bank") {
        const value = parseInt(directive.value ?? "", 10);
        if (Number.isInteger(value)) bankAtC000 = value;
      }
    }
    entryBank.push(bankAtC000);
  }

  // --- Assemble every skool instruction at once (S-T2)
  const toAssemble: { text: string; address: number }[] = [];
  const assembleIndex = new Map<SkoolInstruction, number>();
  if (doc.format === "skool") {
    for (const entry of doc.entries) {
      if (entry.type === "i") continue;
      for (const instruction of entry.instructions) {
        if (!instruction.text) continue;
        assembleIndex.set(instruction, toAssemble.length);
        toAssemble.push({ text: instruction.text, address: instruction.address });
      }
    }
  }
  const assembled = toAssemble.length ? await input.assemble(toAssemble) : [];

  const bankCache = new Map<string, Uint8Array | undefined>();
  const loadBank = async (site: SkoolSite) => {
    const cacheKey = `${site.rom ? "rom" : "bank"}:${site.bank}`;
    if (!bankCache.has(cacheKey)) bankCache.set(cacheKey, await input.bankBytes(site));
    return bankCache.get(cacheKey);
  };
  const byteAt = (site: SkoolSite) => bankCache.get(`${site.rom ? "rom" : "bank"}:${site.bank}`)?.[site.offset];

  for (let entryIndex = 0; entryIndex < doc.entries.length; entryIndex++) {
    const entry = doc.entries[entryIndex];
    const nextEntry = doc.entries[entryIndex + 1];
    const resolve = (address: number) => input.siteOf(address & 0xffff, entryBank[entryIndex]);
    const first = resolve(entry.address);
    if (!first) {
      problems.push({ line: entry.line, message: `$${hex(entry.address)} is not in memory Klive can annotate; the entry is skipped.` });
      continue;
    }
    // --- The bytes of every bank the entry touches, before the byte check reads them
    for (const instruction of entry.instructions) {
      const site = resolve(instruction.address);
      if (site) await loadBank(site);
    }
    await loadBank(first);
    const bank = bankOf(first);
    bank.entries++;
    const interop = bank.interop;
    const key = String(first.offset);
    if (entry.instructions.some((i) => i.hex)) interop.hex = true;

    // --- The header: synopsis, its shape, the entry's directives and block character
    const { synopsis, shape } = entrySynopsis(entry);
    const lines = bank.lines;
    if (synopsis) (lines[key] ??= {}).synopsis = synopsis;
    (interop.entries ??= {})[key] = shape;
    const entryDirectives = entry.directives.filter((d) => d.name !== "bank" && d.name !== "label");
    if (entryDirectives.length) (interop.entryDirectives ??= {})[key] = entryDirectives.map(directiveText);
    if (entry.rawLines?.length) (interop.ignored ??= {})[key] = [...entry.rawLines];

    // --- The extent of each instruction
    type Span = { start: number; length: number; type: AnnotationRegionType; instruction?: SkoolInstruction };
    const spans: Span[] = [];
    let mismatch = false;
    const instructions = entry.instructions;
    if (instructions.length === 0 || instructions[0].address !== entry.address) {
      // --- A control file's entry with no sub-block at its start: the entry's own type runs to the
      // --- first sub-block (or the entry's end)
      const end = instructions[0]?.address ?? nextEntry?.address ?? entry.address + 1;
      spans.push({ start: entry.address, length: Math.max(1, end - entry.address), type: BLOCK_REGION[entry.type] });
    }
    instructions.forEach((instruction, index) => {
      const nextAddress = instructions[index + 1]?.address ?? nextEntry?.address;
      const index_ = assembleIndex.get(instruction);
      const result = index_ !== undefined ? assembled[index_] : undefined;
      let length: number;
      if (result && "bytes" in result) {
        length = result.bytes.length;
        // --- The bytes are Klive's: an instruction that does not match them keeps the entry's
        // --- regions out (R9)
        for (let i = 0; i < length; i++) {
          const site = resolve(instruction.address + i);
          if (!site || byteAt(site) !== result.bytes[i]) {
            if (!mismatch) {
              problems.push({
                line: instruction.line,
                message: `${instruction.text} does not match the bytes at $${hex(instruction.address)}; the entry's regions are not applied.`
              });
            }
            mismatch = true;
            break;
          }
        }
      } else {
        if (result && "error" in result) {
          problems.push({ line: instruction.line, message: `${instruction.text}: ${result.error} (checked by length only).` });
        }
        length = instruction.length ?? Math.max(1, (nextAddress ?? instruction.address + 1) - instruction.address);
      }
      const type = instruction.subType ? BLOCK_REGION[instruction.subType] : instructionRegion(instruction.text, entry.type);
      spans.push({ start: instruction.address, length, type, instruction });
      // --- A control sub-block shorter than the gap to the next one: the rest is the entry's type
      if (doc.format === "ctl" && nextAddress !== undefined && instruction.address + length < nextAddress) {
        spans.push({
          start: instruction.address + length,
          length: nextAddress - instruction.address - length,
          type: BLOCK_REGION[entry.type]
        });
      }
    });
    if (mismatch) bank.mismatchedEntries++;

    // --- Regions (S1), unless the bytes disagreed
    if (!mismatch) {
      for (const span of spans) {
        const site = resolve(span.start);
        if (!site || site.bank !== first.bank || !!site.rom !== !!first.rom) continue;
        let type = span.type;
        if (type === "words" && span.length % 2 !== 0) type = "bytes";
        const end = Math.min(0x3fff, site.offset + span.length - 1);
        const last = bank.regions[bank.regions.length - 1];
        if (last && last.type === type && last.end + 1 === site.offset) last.end = end;
        else bank.regions.push({ start: site.offset, end, type });
      }
    }
    const natural = REGION_BLOCK[spans[0]?.type ?? "disassemble"];
    if (entry.type !== natural) (interop.blocks ??= {})[key] = entry.type;

    // --- Labels, comments, braces, entry points, directives (S2-S5)
    let braceStart: { offset: number; comments: string[] } | undefined;
    instructions.forEach((instruction, index) => {
      const site = resolve(instruction.address);
      if (!site) return;
      const offsetKey = String(site.offset);
      for (const directive of instruction.directives) {
        if (directive.name === "label" && directive.value) {
          const name = uniqueName(directive.value.trim(), takenNames, renamed);
          if (name) bank.labels.push({ name, offset: site.offset });
        } else if (directive.name !== "bank") {
          ((interop.directives ??= {})[offsetKey] ??= []).push(directiveText(directive));
        }
      }
      // --- Every `*`, labelled or not, so the export marks the same entry points (S4)
      if (instruction.marker === "*") (interop.entryPoints ??= []).push(site.offset);
      if (instruction.midComment?.length && index > 0) {
        (lines[offsetKey] ??= {}).synopsis = instruction.midComment.join("\n\n");
      }
      if (instruction.braceOpen) braceStart = { offset: site.offset, comments: [] };
      if (braceStart) {
        if (instruction.comment) braceStart.comments.push(instruction.comment);
        if (instruction.braceClose || index === instructions.length - 1) {
          const text = braceStart.comments.join(" ").trim();
          if (text) (lines[String(braceStart.offset)] ??= {}).comment = text;
          (interop.braces ??= {})[String(braceStart.offset)] = site.offset;
          braceStart = undefined;
        }
      } else if (instruction.comment) {
        (lines[offsetKey] ??= {}).comment = instruction.comment;
      }
    });
    if (entry.endComment.length) {
      const lastInstruction = instructions[instructions.length - 1];
      const site = resolve(lastInstruction?.address ?? entry.address);
      if (site) (lines[String(site.offset)] ??= {}).endComment = entry.endComment.join("\n\n");
    }
    for (const span of entry.spanComments ?? []) {
      const site = resolve(span.address);
      if (site) (lines[String(site.offset)] ??= {}).comment = span.text;
    }
    if (entry.trailingDirectives?.length) {
      problems.push({ line: entry.line, message: "Directives after an entry's last instruction are not kept." });
    }
  }

  // --- Non-entry text, before the entry that follows it (S5)
  for (const nonEntry of doc.nonEntries) {
    const following =
      nonEntry.address !== undefined
        ? doc.entries.find((e) => e.address === nonEntry.address)
        : doc.entries.find((e) => e.line > nonEntry.line);
    const index = following ? doc.entries.indexOf(following) : -1;
    const site = following ? input.siteOf(following.address, entryBank[index]) : undefined;
    if (!site) {
      problems.push({ line: nonEntry.line, message: "Text after the last entry is not kept." });
      continue;
    }
    const bank = bankOf(site);
    const lines = nonEntry.after ? nonEntry.lines.map((l) => `>${l}`) : nonEntry.lines;
    ((bank.interop.nonEntry ??= {})[String(site.offset)] ??= []).push(...lines);
  }
  for (const address of doc.addressDirectives ?? []) {
    const site = input.siteOf(address.address, undefined);
    if (!site) continue;
    const bank = bankOf(site);
    const { directive } = address;
    if (directive.name === "label" && directive.value) {
      const name = uniqueName(directive.value.trim(), takenNames, renamed);
      if (name) bank.labels.push({ name, offset: site.offset });
    } else {
      ((bank.interop.directives ??= {})[String(site.offset)] ??= []).push(directiveText(directive));
    }
  }

  return { banks: [...banks.values()], problems, renamed };
}

function directiveText(directive: { name: string; value?: string }): string {
  return directive.value === undefined ? directive.name : `${directive.name}=${directive.value}`;
}

/** A label name Klive accepts, unique ignoring case (S-T5): the second of two gets `_2`. */
function uniqueName(
  name: string,
  taken: Map<string, string>,
  renamed: { from: string; to: string }[]
): string | undefined {
  let candidate = name.replace(/[^A-Za-z0-9_]/g, "_");
  if (!/^[A-Za-z_]/.test(candidate)) candidate = `L_${candidate}`;
  if (!isValidLabelName(candidate)) candidate = candidate.slice(0, 16);
  if (!isValidLabelName(candidate)) return undefined;
  let unique = candidate;
  for (let n = 2; taken.has(unique.toLowerCase()); n++) unique = `${candidate.slice(0, 14)}_${n}`;
  taken.set(unique.toLowerCase(), name);
  if (unique !== name) renamed.push({ from: name, to: unique });
  return unique;
}

function hex(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

/** An import's regions as a proposal (fill or replace, `origin: "skool"`), like detection's. */
export function proposeSkoolBank(
  bank: SkoolBankImport,
  bankAnnotation: BankAnnotation | undefined,
  mode: ProposalMode
): BankProposal {
  const runs: ClassifiedRun[] = bank.regions.map((region) => ({
    start: region.start,
    end: region.end,
    class: region.type === "disassemble" ? "code" : "data",
    evidence: "observed",
    proposedType: region.type as ProposedType
  }));
  return proposeForBank({ bank: bank.bank, bankAnnotation, runs, mode, origin: "skool" });
}

/**
 * Apply one bank's import: its regions through the proposal, its labels, its comments (fill mode
 * keeps the user's own text where there is some), and its passthrough.
 */
export function applySkoolBank(
  annotations: ProgramAnnotations,
  bank: SkoolBankImport,
  proposal: BankProposal,
  defaultOffsetIndex: (bank: number) => 0 | 1 | 2 | 3
): ProgramAnnotations {
  const withRegions = applyProposals(annotations, [proposal], defaultOffsetIndex, "skool");
  const key = String(bank.bank);
  const current: BankAnnotation = withRegions.banks[key] ?? {
    offsetIndex: defaultOffsetIndex(bank.bank),
    regions: [{ ...DEFAULT_REGION }]
  };
  const next: BankAnnotation = { ...current };

  const labels = [...(current.localLabels ?? [])];
  for (const label of bank.labels) {
    if (labels.some((l) => l.name === label.name && l.value === label.offset)) continue;
    let name = label.name;
    for (let n = 2; labels.some((l) => l.name.toLowerCase() === name.toLowerCase()); n++) name = `${label.name.slice(0, 14)}_${n}`;
    labels.push({ name, value: label.offset });
  }
  if (labels.length) next.localLabels = labels;

  const lines = { ...(current.lineAnnotations ?? {}) };
  for (const [offset, line] of Object.entries(bank.lines)) {
    const existing = lines[offset] ?? {};
    const merged: LineAnnotation = { ...existing };
    for (const field of ["synopsis", "comment", "endComment"] as const) {
      if (line[field] && (proposal.mode === "replace" || !existing[field])) merged[field] = line[field];
    }
    lines[offset] = merged;
  }
  if (Object.keys(lines).length) next.lineAnnotations = lines;
  next.interop = { ...(current.interop ?? {}), skool: bank.interop };
  return { ...withRegions, banks: { ...withRegions.banks, [key]: next } };
}

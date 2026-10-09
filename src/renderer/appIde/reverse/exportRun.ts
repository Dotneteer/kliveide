import type { BankSpace, SlotPaging } from "@common/annotations/bankSpace";
import type { MemoryInfo } from "@common/messaging/EmuApi";
import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { DisassemblyOperandLabelResolver } from "@renderer/appIde/disassemblers/common-types";
import type { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import type { RomPartitionInfo } from "@renderer/appIde/annotations/romAnnotationLoader";
import type { SourceExportResult, SourceLine } from "@common/reverse/sourceExport";

import { exportSource } from "@common/reverse/sourceExport";
import {
  DEFAULT_REGION,
  getBankAnnotation,
  type ProgramAnnotations
} from "@renderer/appIde/annotations/programAnnotations";
import { peekAnnotationSession } from "@renderer/appIde/annotations/annotationSession";
import { loadAnnotationSidecar } from "@renderer/appIde/annotations/annotationSidecar";
import { readBankBytes } from "./detection";

/*
 * Export as source against the running machine (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §7.2,
 * §7.5): what `export-asm` runs.
 *
 * A bank export lists one bank at its address. A range of the 64K view under the current paging is
 * cut into pieces, one per bank (or ROM page) it crosses, the way the live listing is joined across
 * slots (G7.1 T8): each piece is exported with its own `.org`, and the pieces' external names are
 * merged so a name one piece defines is not also an `.equ`.
 */

export type ExportContext = {
  bankSpace: BankSpace;
  /** The active set's sidecar, for RAM banks. */
  annotationPath?: string;
  romPartition: (partition: number) => RomPartitionInfo | undefined;
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">;
  /** Names for addresses the annotations do not name: build symbols, ROM labels, system variables. */
  externalNames?: (slots: SlotPaging) => DisassemblyOperandLabelResolver | undefined;
  /** Set up the machine's custom disassembler for a piece listed at an address. */
  prepareDisassembler?: (slots: SlotPaging) => ((disassembler: Z80Disassembler) => void) | undefined;
  /** The `.model` the machine's code needs (`next`, `Spectrum128`). */
  model?: string;
  /** Whether a bank export on this machine is written with `.bank n` (the 128K family). */
  bankDirectiveFor?: (bank: number, listingBase: number) => number | undefined;
};

export type ExportScope =
  | { kind: "range"; from: number; to: number }
  | { kind: "bank"; bank: number; start?: number; end?: number };

export type ExportResult = SourceExportResult & { pieces: number };

type Piece = {
  site: "bank" | "rom";
  bank: number;
  start: number;
  end: number;
  listingBase: number;
  bytes: Uint8Array;
  annotations: ProgramAnnotations;
};

export async function buildExport(
  ports: { getMemoryContents(partition?: number): Promise<MemoryInfo> },
  context: ExportContext,
  scope: ExportScope,
  options: { skip?: "data" | "gap"; header?: string[] }
): Promise<ExportResult> {
  const memory = await ports.getMemoryContents();
  const slots = memory.slotPartitions;
  const ram = await annotationsAt(context.annotationPath, context.projectService);
  const pieces: Piece[] = [];

  if (scope.kind === "bank") {
    const bytes = await readBankBytes(ports, context.bankSpace, memory, slots, scope.bank);
    if (!bytes) throw new Error(`Bank ${scope.bank} cannot be read.`);
    const annotations = withBank(ram, context.bankSpace, scope.bank);
    const pagedAt = context.bankSpace.addressesOf({ bank: scope.bank, offset: 0 }, slots)[0];
    const listingBase =
      pagedAt ?? getBankAnnotation(annotations, scope.bank)!.offsetIndex * 0x4000;
    pieces.push({
      site: "bank",
      bank: scope.bank,
      start: scope.start ?? 0,
      end: scope.end ?? 0x3fff,
      listingBase,
      bytes,
      annotations
    });
  } else {
    let address = scope.from & 0xffff;
    const last = scope.to & 0xffff;
    while (address <= last) {
      const site = context.bankSpace.siteAt(address, slots);
      if (!site) throw new Error(`$${address.toString(16)} is not in annotatable memory.`);
      const pieceBase = (address - site.offset) & 0xffff;
      // --- The piece runs to the end of the range or to where the site changes
      let end = address;
      while (end < last) {
        const next = context.bankSpace.siteAt(end + 1, slots);
        if (!next || next.kind !== site.kind || (end + 1 - next.offset) !== pieceBase) break;
        if (site.kind === "bank" && next.kind === "bank" && next.bank !== site.bank) break;
        end++;
      }
      if (site.kind === "bank") {
        const bytes = await readBankBytes(ports, context.bankSpace, memory, slots, site.bank);
        if (!bytes) throw new Error(`Bank ${site.bank} cannot be read.`);
        pieces.push({
          site: "bank",
          bank: site.bank,
          start: site.offset,
          end: site.offset + (end - address),
          listingBase: pieceBase,
          bytes,
          annotations: withBank(ram, context.bankSpace, site.bank)
        });
      } else {
        const rom = context.romPartition(site.partition);
        const layer = rom?.layers.find((l) => l.annotations.banks[String(l.page)]);
        const page = layer?.page ?? 0;
        pieces.push({
          site: "rom",
          bank: page,
          start: site.offset,
          end: site.offset + (end - address),
          listingBase: pieceBase,
          bytes: memory.memory.slice(pieceBase, pieceBase + 0x4000),
          annotations: layer?.annotations ?? {
            schemaVersion: 3,
            machine: "rom",
            banks: { [String(page)]: { offsetIndex: 0, regions: [{ ...DEFAULT_REGION }] } }
          }
        });
      }
      address = end + 1;
      if (address > 0xffff) break;
    }
  }

  const results: SourceExportResult[] = [];
  for (const piece of pieces) {
    results.push(
      await exportSource({
        annotations: piece.annotations,
        bank: piece.bank,
        bytes: piece.bytes,
        listingBase: piece.listingBase,
        range: { start: piece.start, end: piece.end },
        z80n: context.bankSpace.extendedSet,
        skip: options.skip,
        externalNames: context.externalNames?.(slots),
        prepareDisassembler: piece.site === "rom" ? context.prepareDisassembler?.(slots) : undefined,
        ...(scope.kind === "bank" && context.bankDirectiveFor
          ? { bankDirective: context.bankDirectiveFor(piece.bank, piece.listingBase) }
          : {})
      })
    );
  }
  return { ...combine(results, options.header ?? [], context.model), pieces: pieces.length };
}

/**
 * Join exported pieces into one file: one header, one `.model`, one set of `.equ`s — less any name a
 * piece defines.
 */
export function combine(results: SourceExportResult[], header: string[], model?: string): SourceExportResult {
  const defined = new Set<string>();
  for (const result of results) {
    for (const line of result.lines) if (line.kind === "row" && line.label) defined.add(line.label.toLowerCase());
  }
  const equs = new Map<string, SourceLine & { kind: "equ" }>();
  const bodies: SourceLine[] = [];
  for (const result of results) {
    for (const line of result.lines) {
      if (line.kind === "equ") {
        if (!defined.has(line.name.toLowerCase())) equs.set(line.name.toLowerCase(), line);
      } else if (!(line.kind === "directive" && line.text.startsWith(".model"))) {
        bodies.push(line);
      }
    }
    bodies.push({ kind: "blank" });
  }
  const lines: SourceLine[] = header.map((text) => ({ kind: "comment", text }) as SourceLine);
  if (lines.length) lines.push({ kind: "blank" });
  if (model) lines.push({ kind: "directive", text: `.model ${model}` });
  const equLines = [...equs.values()].sort((a, b) => a.value - b.value);
  if (equLines.length) lines.push(...equLines, { kind: "blank" });
  lines.push(...bodies);
  return {
    lines,
    expected: results.flatMap((r) => r.expected),
    notes: [...new Set(results.flatMap((r) => r.notes))]
  };
}

/** The annotations with the bank present (a default one when the set does not describe it). */
function withBank(annotations: ProgramAnnotations | undefined, bankSpace: BankSpace, bank: number): ProgramAnnotations {
  const base: ProgramAnnotations = annotations ?? { schemaVersion: 3, machine: bankSpace.id, globalLabels: [], banks: {} };
  if (getBankAnnotation(base, bank)) return base;
  return {
    ...base,
    banks: {
      ...base.banks,
      [String(bank)]: { offsetIndex: bankSpace.defaultOffsetIndex(bank), regions: [{ ...DEFAULT_REGION }] }
    }
  };
}

async function annotationsAt(
  path: string | undefined,
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">
): Promise<ProgramAnnotations | undefined> {
  if (!path) return undefined;
  const live = peekAnnotationSession(path);
  if (live) return live;
  const state = await loadAnnotationSidecar(projectService, { fullPath: path });
  return state.status === "loaded" ? state.annotations : undefined;
}

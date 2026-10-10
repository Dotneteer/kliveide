import type { BankSpace, SlotPaging } from "@common/annotations/bankSpace";
import type { MemoryInfo } from "@common/messaging/EmuApi";
import type { ProposalMode } from "@common/reverse/proposal";
import type { DetectionContext, DetectionRun, DetectionTarget } from "./detection";

import { parseSkool } from "@common/reverse/skool/skoolParse";
import { parseCtl } from "@common/reverse/skool/ctlParse";
import {
  proposeSkoolBank,
  skoolToAnnotations,
  type SkoolSite
} from "@common/reverse/skool/skoolToAnnotations";
import { liveRowTarget } from "@renderer/appIde/annotations/liveListingPort";
import { peekAnnotationSession } from "@renderer/appIde/annotations/annotationSession";
import { loadAnnotationSidecar } from "@renderer/appIde/annotations/annotationSidecar";
import { readBankBytes } from "./detection";

/*
 * `skool-import` against the running machine (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §6.4):
 * the file's addresses resolved through the bank space (S-T1), its instructions checked against the
 * machine's bytes (S-T2), and the result offered as the Detect dialog's proposal table.
 */

const SPECTRUM_SPACES = new Set(["sp48", "sp128", "plus3", "scorpion", "timex"]);

/**
 * Where a skool address is: the 48K map on the Spectrum family (bank 5 at `$4000`, 2 at `$8000`,
 * and at `$C000` bank 0 or the one `@bank` named), the given paging on the Next (`@bank` naming the
 * bank at `$C000`), and the machine's fixed map elsewhere. ROM addresses go to ROM page 0.
 */
export function skoolSiteResolver(
  bankSpace: BankSpace,
  slots: SlotPaging
): (address: number, bankAtC000: number | undefined) => SkoolSite | undefined {
  return (address, bankAtC000) => {
    const a = address & 0xffff;
    if (SPECTRUM_SPACES.has(bankSpace.id)) {
      if (a < 0x4000) return { rom: true, bank: 0, offset: a };
      const bank = a < 0x8000 ? 5 : a < 0xc000 ? 2 : (bankAtC000 ?? 0);
      return { bank, offset: a & 0x3fff };
    }
    if (bankSpace.id === "next" && a >= 0xc000 && bankAtC000 !== undefined) {
      return { bank: bankAtC000, offset: a - 0xc000 };
    }
    const site = bankSpace.siteAt(a, slots);
    if (!site) return undefined;
    return site.kind === "rom" ? { rom: true, bank: 0, offset: site.offset } : { bank: site.bank, offset: site.offset };
  };
}

/** Assembles skool instructions, each at its address: the main process's `assembleLines`. */
export type SkoolAssembler = (
  lines: { text: string; address: number }[],
  z80n: boolean
) => Promise<({ bytes: number[] } | { error: string })[]>;

export async function buildSkoolImport(
  ports: { getMemoryContents(partition?: number): Promise<MemoryInfo> },
  context: DetectionContext,
  path: string,
  text: string,
  mode: ProposalMode,
  assembleLines: SkoolAssembler
): Promise<DetectionRun> {
  if (!context.activeSet) {
    return { targets: [], problem: "No annotation set is active: use ann-new, or open a project." };
  }
  const memory = await ports.getMemoryContents();
  const slots = memory.slotPartitions;
  const { bankSpace } = context;
  const doc = /\.ctl$/i.test(path) ? parseCtl(text) : parseSkool(text);
  const result = await skoolToAnnotations({
    doc,
    siteOf: skoolSiteResolver(bankSpace, slots),
    bankBytes: async (site) =>
      site.rom ? memory.memory.slice(0, 0x4000) : readBankBytes(ports, bankSpace, memory, slots, site.bank),
    assemble: (lines) => assembleLines(lines, bankSpace.extendedSet)
  });

  const notes = [
    ...result.problems.map((p) => `line ${p.line}: ${p.message}`),
    ...result.renamed.map((r) => `The label ${r.from} is imported as ${r.to}.`)
  ];
  const targets: DetectionTarget[] = [];
  const ram = await annotationsAt(context.activeSet.path, context.projectService);
  for (const bank of result.banks) {
    if (bank.rom) {
      // --- Into the user's own ROM layer only, never a shipped sidecar (R8, Q7)
      const write = liveRowTarget(0, { bankSpace, slots, activeSet: context.activeSet, romPartition: context.romPartition });
      if (!("annotationPath" in write) || write.kind !== "rom") {
        notes.push("The file's ROM entries are skipped: the ROM page has not been identified.");
        continue;
      }
      const romBank = { ...bank, bank: write.bank };
      const rom = await annotationsAt(write.annotationPath, context.projectService);
      targets.push({
        name: "ROM (your ROM annotations)",
        write,
        proposal: proposeSkoolBank(romBank, rom?.banks[String(write.bank)], mode),
        skool: romBank
      });
      continue;
    }
    const offsetIndex = bankSpace.defaultOffsetIndex(bank.bank);
    targets.push({
      name: `bank ${bank.bank}`,
      write: {
        kind: "bank",
        annotationPath: context.activeSet.path,
        bank: bank.bank,
        offset: 0,
        disassOffset: offsetIndex * 0x4000,
        create: { machine: context.activeSet.machine, offsetIndex },
        destination: context.activeSet.path.split(/[\\/]/).pop() ?? context.activeSet.path
      },
      proposal: proposeSkoolBank(bank, ram?.banks[String(bank.bank)], mode),
      skool: bank
    });
  }
  return targets.length
    ? { targets, notes }
    : { targets, notes, problem: "The file has no entries Klive can place in this machine's memory." };
}

async function annotationsAt(
  path: string,
  projectService: DetectionContext["projectService"]
) {
  const live = peekAnnotationSession(path);
  if (live) return live;
  const state = await loadAnnotationSidecar(projectService, { fullPath: path });
  return state.status === "loaded" ? state.annotations : undefined;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export type SkoolExportScope =
  | { kind: "range"; from: number; to: number }
  | { kind: "bank"; bank: number }
  | { kind: "all" };

export type SkoolExportFile = {
  /** Added before the extension when the export is split: `-bank3`. */
  suffix?: string;
  text: string;
};

/**
 * The skool or ctl text for a scope (§6.5): a 48K file is one file with `@org` at its first entry;
 * a 128K or +3 export is the 48K view (banks 5, 2, 0) followed by every other annotated bank as an
 * `@bank`-switched section at `$C000` — or one file per bank with `split`; a Next bank is one file
 * per bank at `$C000`, with a header naming it (Q6).
 */
export async function buildSkoolExport(
  ports: { getMemoryContents(partition?: number): Promise<MemoryInfo> },
  context: {
    bankSpace: BankSpace;
    annotationPath?: string;
    projectService: DetectionContext["projectService"];
    prepareDisassembler?: (slots: SlotPaging) => ((disassembler: any) => void) | undefined;
  },
  scope: SkoolExportScope,
  format: "skool" | "ctl",
  split = false
): Promise<SkoolExportFile[]> {
  const { annotationsToSkool } = await import("@common/reverse/skool/annotationsToSkool");
  const memory = await ports.getMemoryContents();
  const slots = memory.slotPartitions;
  const { bankSpace } = context;
  const annotations = context.annotationPath ? await annotationsAt(context.annotationPath, context.projectService) : undefined;
  if (!annotations) throw new Error("There are no annotations to export: no annotation set is active, or it is empty.");
  const z80n = bankSpace.extendedSet;
  const isNext = bankSpace.id === "next";
  const isBanked = ["sp128", "plus3", "scorpion"].includes(bankSpace.id);

  const section = async (bank: number, options: { org?: boolean; bankDirective?: number; range?: { start: number; end: number } }) => {
    const bytes = await readBankBytes(ports, bankSpace, memory, slots, bank);
    if (!bytes) throw new Error(`Bank ${bank} cannot be read.`);
    const pagedAt = bankSpace.addressesOf({ bank, offset: 0 }, slots)[0];
    const listingBase = isNext ? 0xc000 : options.bankDirective !== undefined ? 0xc000 : (pagedAt ?? bankSpace.defaultOffsetIndex(bank) * 0x4000);
    const withBank = annotations.banks[String(bank)]
      ? annotations
      : { ...annotations, banks: { ...annotations.banks, [String(bank)]: { offsetIndex: bankSpace.defaultOffsetIndex(bank), regions: [{ start: 0, end: 0x3fff, type: "disassemble" as const }] } } };
    return annotationsToSkool({
      annotations: withBank,
      bank,
      bytes,
      listingBase,
      range: options.range,
      z80n,
      format,
      org: options.org,
      bankDirective: options.bankDirective,
      header: isNext ? [`ZX Spectrum Next bank ${bank}, at $C000`] : undefined
    });
  };

  if (scope.kind === "bank") {
    return [{ text: await section(scope.bank, { org: true }) }];
  }
  if (scope.kind === "range") {
    const parts: string[] = [];
    let address = scope.from & 0xffff;
    while (address <= scope.to) {
      const site = bankSpace.siteAt(address, slots);
      if (!site || site.kind !== "bank") {
        address = (address | 0x1fff) + 1;
        continue;
      }
      const pieceEnd = Math.min(scope.to, (address - site.offset) + 0x3fff);
      parts.push(
        await section(site.bank, {
          org: parts.length === 0,
          range: { start: site.offset, end: site.offset + (pieceEnd - address) }
        })
      );
      address = pieceEnd + 1;
    }
    return [{ text: parts.join("\n") }];
  }

  const annotated = Object.keys(annotations.banks).map(Number).sort((a, b) => a - b);
  if (isNext) {
    const files: SkoolExportFile[] = [];
    for (const bank of annotated) files.push({ suffix: `-bank${bank}`, text: await section(bank, { org: true }) });
    return files;
  }
  const home = bankSpace.ramBanks.filter((bank) => [5, 2, 0].includes(bank));
  const others = isBanked ? annotated.filter((bank) => !home.includes(bank)) : [];
  if (split) {
    const files: SkoolExportFile[] = [];
    for (const bank of [...home, ...others]) {
      files.push({ suffix: `-bank${bank}`, text: await section(bank, { org: true, ...(others.includes(bank) ? { bankDirective: bank } : {}) }) });
    }
    return files;
  }
  const parts: string[] = [];
  for (const bank of home) parts.push(await section(bank, { org: parts.length === 0 }));
  for (const bank of others) parts.push(await section(bank, { bankDirective: bank }));
  return [{ text: parts.join("\n") }];
}

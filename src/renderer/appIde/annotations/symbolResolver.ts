import type {
  DisassemblyOperandLabelResolver
} from "@renderer/appIde/disassemblers/common-types";
import type { BankSpace, MemorySite, SlotPaging } from "@common/annotations/bankSpace";
import { compilationLabels, type RoutineLabel } from "@common/profile/routineMap";

import { overlayRegion } from "./annotatedDisassembly";
import {
  DEFAULT_REGION,
  getBankAnnotation,
  type AnnotationLabel,
  type AnnotationRegion,
  type BankAnnotation,
  type LineAnnotation,
  type OperandReference,
  type ProgramAnnotations
} from "./programAnnotations";
import { romLayerApplies, romLayerBank, type RomLayer, type RomLayersOf } from "./romLayer";

/*
 * One address-to-name resolver for every view (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`
 * §4.4, A8).
 *
 * Before this, each view built its own: the Disassembly view named operands from a NEX sidecar and
 * the system variables, Execution History from the build's labels, the Profiler from its routine
 * map, and the Call Stack and `dis` from nothing. A name a user wrote showed in one view and not the
 * next. Now every view asks the same object, which consults its sources in a fixed order:
 *
 * 1. **build** — the last compilation's labels (which also gives the live view the compiled
 *    program's row labels it never had, Q8);
 * 2. **annotation** — the active annotation set, through the machine's bank space;
 * 3. **rom** — the paged ROM page's sidecars: the user's layer, then the shipped one (§5.3);
 * 4. **sysvar** — the machine's system variables, for *data* operands only, as before.
 *
 * A row shows one name; the others are kept for the tooltip (`allAt`), never dropped (T9).
 */

export type SymbolSource = "build" | "annotation" | "rom" | "sysvar";

export type SymbolHit = {
  name: string;
  source: SymbolSource;
  /** Where the name came from, for a tooltip: "Build", "game.z80.dis", "ROM: sp48.rom". */
  origin: string;
  /** For a ZX80/ZX81 mirror: the canonical address the name was written at. */
  mirrorOf?: number;
};

/** A build label, in the space its compilation placed it. */
export type BuildLabel = { name: string; address: number; partition?: number };

export type AddressSymbolsInput = {
  bankSpace?: BankSpace;
  /** The last compilation's labels (`compilationLabels`). */
  buildLabels?: readonly BuildLabel[];
  /** The active annotation set. */
  annotations?: ProgramAnnotations;
  /** The active set's file name, for the tooltip. */
  annotationOrigin?: string;
  /** The ROM layers of a ROM partition. */
  romLayersOf?: RomLayersOf;
  /** Whether ROM names are shown (the Disassembly view's **ROM labels** toggle, §5.5). */
  romLabels?: boolean;
  /** System variable names for data operands. */
  sysVarResolver?: DisassemblyOperandLabelResolver;
};

/** The annotations a listing piece is generated from: a program bank, or a ROM page's layers merged. */
export type AnnotatedSite = {
  kind: "bank" | "rom";
  /** The model the bank generator reads. For a ROM page, a merged copy keyed by `bank`. */
  annotations: ProgramAnnotations;
  bank: number;
  bankAnnotation: BankAnnotation;
  /** Where edits to this site go: the active set's path, or the user ROM layer's. */
  origin: string;
  /** For a ROM page: the partition it is paged as. */
  partition?: number;
};

export interface AddressSymbols {
  /** The label at a Z80 address under the given paging, with its source. */
  labelAt(address: number, slots: SlotPaging): SymbolHit | undefined;
  /** All names at the address, in precedence order, for tooltips (T9). */
  allAt(address: number, slots: SlotPaging): SymbolHit[];
  /** The containing routine and offset, for call stacks and profiles: `PRINT_OUT+12`. */
  routineAt(
    address: number,
    slots: SlotPaging
  ): { name: string; offset: number; source: SymbolSource } | undefined;
  /** Names for 16-bit operands under the given paging. */
  operandResolver(slots: SlotPaging): DisassemblyOperandLabelResolver | undefined;
  /** The annotations behind a memory site, for the annotated listing. */
  annotatedSiteAt(site: MemorySite): AnnotatedSite | undefined;
  /** Whether any source can name anything at all. */
  readonly empty: boolean;
}

/** The window `routineAt` looks in: the address's own 16K slot. */
const ROUTINE_WINDOW = 0x4000;

export function createAddressSymbols(input: AddressSymbolsInput): AddressSymbols {
  const { bankSpace, annotations } = input;
  const romLabels = input.romLabels ?? true;
  const annotationOrigin = input.annotationOrigin ?? "Annotations";

  // --- Build labels by address, and sorted for `routineAt`
  const buildByAddress = new Map<number, BuildLabel[]>();
  for (const label of input.buildLabels ?? []) {
    const address = label.address & 0xffff;
    let list = buildByAddress.get(address);
    if (!list) buildByAddress.set(address, (list = []));
    if (!list.some((other) => other.name === label.name && other.partition === label.partition)) {
      list.push(label);
    }
  }
  const buildSorted = [...(input.buildLabels ?? [])].sort((a, b) => a.address - b.address);

  const globalByAddress = new Map<number, AnnotationLabel[]>();
  for (const label of annotations?.globalLabels ?? []) {
    let list = globalByAddress.get(label.value);
    if (!list) globalByAddress.set(label.value, (list = []));
    list.push(label);
  }

  const romSiteCache = new Map<number, AnnotatedSite | null>();

  const partitionAt = (address: number, slots: SlotPaging) => slots?.[(address >> 13) & 0x07];

  const buildHits = (address: number, slots: SlotPaging): SymbolHit[] => {
    const labels = buildByAddress.get(address);
    if (!labels) return [];
    // --- With no paging to judge by (a history record), a banked label is taken at its address
    const paged = partitionAt(address, slots);
    return labels
      .filter((label) => !slots || label.partition === undefined || label.partition === paged)
      .map((label) => ({ name: label.name, source: "build" as const, origin: "Build" }));
  };

  const siteAt = (address: number, slots: SlotPaging): MemorySite | undefined =>
    bankSpace?.siteAt(address, slots);

  const mirrorOf = (address: number): number | undefined => {
    const canonical = (bankSpace as { canonicalAddress?: (a: number) => number })?.canonicalAddress?.(
      address
    );
    return canonical !== undefined && canonical !== address ? canonical : undefined;
  };

  const annotationHits = (address: number, slots: SlotPaging): SymbolHit[] => {
    if (!annotations) return [];
    const hits: SymbolHit[] = (globalByAddress.get(address) ?? []).map((label) => ({
      name: label.name,
      source: "annotation" as const,
      origin: annotationOrigin
    }));
    const site = siteAt(address, slots);
    if (site?.kind === "bank") {
      const mirror = mirrorOf(address);
      for (const label of getBankAnnotation(annotations, site.bank)?.localLabels ?? []) {
        if (label.value !== site.offset) continue;
        hits.push({
          name: label.name,
          source: "annotation",
          origin: annotationOrigin,
          ...(mirror !== undefined ? { mirrorOf: mirror } : {})
        });
      }
    }
    return hits;
  };

  const romHits = (address: number, slots: SlotPaging): SymbolHit[] => {
    if (!romLabels || !input.romLayersOf) return [];
    const site = siteAt(address, slots);
    if (site?.kind !== "rom") return [];
    const hits: SymbolHit[] = [];
    // --- The ZX81 ROM is seen again at $2000 on the 1K/16K models: name it there, marked
    const mirror = mirrorOf(address);
    for (const layer of input.romLayersOf(site.partition)) {
      if (!romLayerApplies(layer, site.offset)) continue;
      for (const label of romLayerBank(layer)?.localLabels ?? []) {
        if (label.value === site.offset) {
          hits.push({
            name: label.name,
            source: "rom",
            origin: layer.origin,
            ...(mirror !== undefined ? { mirrorOf: mirror } : {})
          });
        }
      }
    }
    return hits;
  };

  const allAt = (address: number, slots: SlotPaging): SymbolHit[] => {
    const a = address & 0xffff;
    return [...buildHits(a, slots), ...annotationHits(a, slots), ...romHits(a, slots)];
  };

  const labelAt = (address: number, slots: SlotPaging): SymbolHit | undefined =>
    allAt(address, slots)[0];

  /**
   * The nearest label at or below `address` from every source, in the same 16K window: paging
   * changes at slot boundaries, so a label in the slot below names nothing above it.
   */
  const routineAt: AddressSymbols["routineAt"] = (address, slots) => {
    const a = address & 0xffff;
    const windowStart = a & ~(ROUTINE_WINDOW - 1) & 0xffff;
    let best: { name: string; at: number; source: SymbolSource; rank: number } | undefined;
    const offer = (name: string, at: number, source: SymbolSource, rank: number) => {
      if (at > a || at < windowStart) return;
      if (!best || at > best.at || (at === best.at && rank < best.rank)) {
        best = { name, at, source, rank };
      }
    };

    // --- 1. Build labels: the highest one at or below, paged in
    const paged = partitionAt(a, slots);
    for (let i = buildSorted.length - 1; i >= 0; i--) {
      const label = buildSorted[i];
      if (label.address > a) continue;
      if (label.address < windowStart) break;
      if (slots && label.partition !== undefined && label.partition !== paged) continue;
      offer(label.name, label.address, "build", 0);
      break;
    }

    // --- 2. The annotation set: global labels, then the bank's local labels
    const site = siteAt(a, slots);
    if (annotations) {
      for (const label of annotations.globalLabels ?? []) offer(label.name, label.value, "annotation", 1);
      if (site?.kind === "bank") {
        for (const label of getBankAnnotation(annotations, site.bank)?.localLabels ?? []) {
          if (label.value <= site.offset) offer(label.name, a - (site.offset - label.value), "annotation", 1);
        }
      }
    }

    // --- 3. The ROM page's layers
    if (romLabels && site?.kind === "rom" && input.romLayersOf) {
      input.romLayersOf(site.partition).forEach((layer, index) => {
        for (const label of romLayerBank(layer)?.localLabels ?? []) {
          if (label.value > site.offset || !romLayerApplies(layer, label.value)) continue;
          offer(label.name, a - (site.offset - label.value), "rom", 2 + index);
        }
      });
    }

    const found = best as { name: string; at: number; source: SymbolSource } | undefined;
    return found ? { name: found.name, offset: a - found.at, source: found.source } : undefined;
  };

  const operandResolver = (slots: SlotPaging): DisassemblyOperandLabelResolver | undefined => {
    if (empty && !input.sysVarResolver) return undefined;
    return (operand) => {
      const value = operand.operandValue;
      if (value !== undefined) {
        const hit = labelAt(value, slots);
        if (hit) return hit.name;
      }
      return input.sysVarResolver?.(operand);
    };
  };

  const annotatedSiteAt = (site: MemorySite): AnnotatedSite | undefined => {
    if (site.kind === "bank") {
      const bankAnnotation = annotations ? getBankAnnotation(annotations, site.bank) : undefined;
      if (!annotations || !bankAnnotation) return undefined;
      return {
        kind: "bank",
        annotations,
        bank: site.bank,
        bankAnnotation,
        origin: annotationOrigin
      };
    }
    if (!romLabels || !input.romLayersOf) return undefined;
    const cached = romSiteCache.get(site.partition);
    if (cached !== undefined) return cached ?? undefined;
    const merged = mergeRomLayers(input.romLayersOf(site.partition));
    const result = merged ? { ...merged, partition: site.partition } : undefined;
    romSiteCache.set(site.partition, result ?? null);
    return result;
  };

  const empty =
    !input.buildLabels?.length &&
    !annotations &&
    !(romLabels && input.romLayersOf);

  return { labelAt, allAt, routineAt, operandResolver, annotatedSiteAt, empty };
}

/**
 * A ROM page's layers as one bank the listing generator can read.
 *
 * Labels, comments and operand references come from the first layer that has them at an offset, so
 * the user's own win; a byte-bound layer contributes only the offsets that survived binding. Regions
 * start from the shipped layer (its unbound data regions dropped back to code) and the user's data
 * regions are laid over them — a user who has only added a label has a whole-page `disassemble`
 * region, which must not hide the shipped data regions.
 */
export function mergeRomLayers(
  layers: readonly RomLayer[]
): Omit<AnnotatedSite, "partition"> | undefined {
  const banks = layers
    .map((layer) => ({ layer, bank: romLayerBank(layer) }))
    .filter((entry): entry is { layer: RomLayer; bank: BankAnnotation } => !!entry.bank);
  if (banks.length === 0) return undefined;

  const labels: AnnotationLabel[] = [];
  const labelOffsets = new Set<number>();
  const lineAnnotations: Record<string, LineAnnotation> = {};
  const operandReferences: Record<string, OperandReference[]> = {};
  for (const { layer, bank } of banks) {
    for (const label of bank.localLabels ?? []) {
      if (labelOffsets.has(label.value) || !romLayerApplies(layer, label.value)) continue;
      labelOffsets.add(label.value);
      labels.push(label);
    }
    for (const [key, line] of Object.entries(bank.lineAnnotations ?? {})) {
      if (!romLayerApplies(layer, Number(key))) continue;
      const merged = (lineAnnotations[key] ??= {});
      if (line.synopsis && !merged.synopsis) merged.synopsis = line.synopsis;
      if (line.comment && !merged.comment) merged.comment = line.comment;
    }
    for (const [key, references] of Object.entries(bank.operandReferences ?? {})) {
      if (!romLayerApplies(layer, Number(key)) || operandReferences[key]) continue;
      operandReferences[key] = references;
    }
  }

  // --- Regions: the last (shipped) layer's, then each earlier layer's data regions over them
  let regions: AnnotationRegion[] = [{ ...DEFAULT_REGION }];
  for (let i = banks.length - 1; i >= 0; i--) {
    const { layer, bank } = banks[i];
    for (const region of bank.regions) {
      if (region.type === "disassemble") continue;
      if (layer.boundRegions && !layer.boundRegions.has(region.start)) continue;
      regions = overlayRegion(regions, region);
    }
  }

  const first = banks[0];
  const bankAnnotation: BankAnnotation = {
    offsetIndex: 0,
    regions,
    localLabels: labels,
    ...(Object.keys(lineAnnotations).length ? { lineAnnotations } : {}),
    ...(Object.keys(operandReferences).length ? { operandReferences } : {})
  };
  const page = first.layer.page;
  return {
    kind: "rom",
    annotations: { schemaVersion: 3, machine: "rom", banks: { [String(page)]: bankAnnotation } },
    bank: page,
    bankAnnotation,
    origin: banks.find((entry) => entry.layer.kind === "user")?.layer.path ?? first.layer.path
  };
}

/**
 * The last compilation's labels, as the resolver reads them: the non-local code labels of the Klive
 * assembler's, sjasmplus's or Klive BASIC's symbol table, with their partitions (`compilationLabels`).
 */
export function buildLabelsOfCompilation(
  compilation: unknown,
  machineId: string | undefined
): BuildLabel[] {
  if (!compilation) return [];
  try {
    return buildLabelsOf(
      compilationLabels(compilation as Parameters<typeof compilationLabels>[0], machineId)
    );
  } catch {
    // --- A compilation from a tool whose output does not have the shape: no names, not a crash
    return [];
  }
}

/** Build labels as `routineMap`'s `compilationLabels` gives them. */
export function buildLabelsOf(labels: readonly RoutineLabel[]): BuildLabel[] {
  return labels.map((label) => ({
    name: label.name,
    address: label.address,
    ...(label.partition !== undefined ? { partition: label.partition } : {})
  }));
}

/**
 * The active set's and the ROM layers' labels as routine labels, for the profiler's routine map:
 * each bank label at the address its bank breakpoint is armed at, with that partition.
 */
export function annotationRoutineLabels(
  input: Pick<AddressSymbolsInput, "annotations" | "bankSpace" | "romLayersOf" | "romLabels">,
  romPartitions: readonly number[] = []
): RoutineLabel[] {
  const result: RoutineLabel[] = [];
  const { annotations, bankSpace } = input;
  if (annotations && bankSpace) {
    for (const label of annotations.globalLabels ?? []) {
      result.push({ name: label.name, address: label.value });
    }
    for (const [bankKey, bank] of Object.entries(annotations.banks)) {
      for (const label of bank.localLabels ?? []) {
        const site = { bank: Number(bankKey), offset: label.value };
        const address = bankSpace.candidateAddresses(site)[0];
        if (address === undefined) continue;
        const partition = bankSpace.partitionOf(site);
        result.push({
          name: label.name,
          address,
          ...(partition !== undefined ? { partition } : {})
        });
      }
    }
  }
  if ((input.romLabels ?? true) && input.romLayersOf) {
    for (const partition of romPartitions) {
      const merged = mergeRomLayers(input.romLayersOf(partition));
      for (const label of merged?.bankAnnotation.localLabels ?? []) {
        // --- A partitionless machine (the 48K, the ZX80/81) has its ROM at its own addresses
        const partitioned = bankSpace?.id !== "sp48" && bankSpace?.id !== "zx81" && bankSpace?.id !== "zx80";
        result.push({
          name: label.name,
          address: label.value,
          ...(partitioned ? { partition } : {})
        });
      }
    }
  }
  return result;
}

import type { BankSpace, SlotPaging } from "@common/annotations/bankSpace";
import type { MemoryInfo } from "@common/messaging/EmuApi";
import type { ProfileLayout } from "@common/profile/layouts/profileLayout";
import type { ProfileEdges, ProfileTouched, ProfileView } from "@common/profile/profileTypes";
import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { ActiveAnnotationSet } from "@renderer/appIde/annotations/activeAnnotationSet";
import type { LiveRowTarget } from "@renderer/appIde/annotations/liveListingPort";
import type { RomPartitionInfo } from "@renderer/appIde/annotations/romAnnotationLoader";
import type { BankAnnotation, ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";

import { profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { PF_EXECUTED, PROFILE_KEY_UNMAPPED } from "@common/profile/profileTypes";
import { classifyBank, type DetectOptions } from "@common/reverse/classify";
import { reachBank } from "@common/reverse/reach";
import { applyProposals, proposeForBank, type BankProposal, type ProposalMode } from "@common/reverse/proposal";
import { spectrumRomInstructionLength } from "@common/reverse/spectrumRomInline";
import { liveRowTarget } from "@renderer/appIde/annotations/liveListingPort";
import { ensureAnnotatedBank } from "@renderer/appIde/annotations/liveAnnotationEditing";
import { loadAnnotationSidecar } from "@renderer/appIde/annotations/annotationSidecar";
import {
  flushAnnotationSession,
  peekAnnotationSession,
  updateAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";
import { SCREEN_AREA_RANGE } from "@renderer/appIde/annotations/annotatedDisassembly";
import { applySkoolBank, type SkoolBankImport } from "@common/reverse/skool/skoolToAnnotations";

/*
 * Code/data auto-detection against the running machine (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`
 * §4.6, phase D3): what `ann-detect` and the *Detect code and data* dialog share.
 *
 * It reads each target bank's bytes and coverage flags through the bank space — a Next bank is two
 * 8K partitions (D-T7), a 48K bank is a fixed address range — runs the static walk and the
 * classifier, and builds a proposal per bank. Applying publishes one session update per sidecar
 * (R1, R3); the model before it is kept, so the last detection can be undone.
 *
 * Machine access goes through `DetectionPorts`, a slice of the Emu API, so the whole flow runs in a
 * test against a fake.
 */

export type DetectionPorts = {
  getMemoryContents(partition?: number): Promise<MemoryInfo>;
  getProfileTouched(mask?: number): Promise<ProfileTouched | undefined>;
  getProfileEdges(): Promise<ProfileEdges | undefined>;
  getProfileView(partition?: number, withCounts?: boolean): Promise<ProfileView | undefined>;
};

export type DetectionContext = {
  bankSpace: BankSpace;
  layout: ProfileLayout;
  activeSet: ActiveAnnotationSet | undefined;
  romPartition: (partition: number) => RomPartitionInfo | undefined;
  /** Whether a ROM partition holds the 48K BASIC ROM (its inline RST bytes, §4.4). */
  isBasic48Rom: (partition: number) => boolean;
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">;
};

/** Which banks: the RAM banks paged in now, every RAM bank with coverage, one bank, or the ROM. */
export type DetectionScope = { kind: "paged" } | { kind: "all" } | { kind: "bank"; bank: number } | { kind: "rom" };

export type DetectionRequest = {
  scope: DetectionScope;
  mode: ProposalMode;
  reach: boolean;
  text: boolean;
  words: boolean;
  unknown: "keep" | "bytes";
  /** Propose the screen area as `skip` on the Spectrum bank spaces (Q3). On by default. */
  screen: boolean;
};

export const DEFAULT_DETECTION_REQUEST: DetectionRequest = {
  scope: { kind: "paged" },
  mode: "fill",
  reach: true,
  text: false,
  words: false,
  unknown: "keep",
  screen: true
};

/** One bank's (or ROM page's) proposal, and where applying it writes. */
export type DetectionTarget = {
  /** How the user calls it: "bank 5", "ROM". */
  name: string;
  /** Where it is written and how to create it (`ensureAnnotatedBank`). */
  write: LiveRowTarget;
  proposal: BankProposal;
  /** A SkoolKit import's labels, comments and passthrough for the bank, applied with its regions. */
  skool?: SkoolBankImport;
};

export type DetectionRun = {
  targets: DetectionTarget[];
  /** Why there is nothing to propose, when there is not. */
  problem?: string;
  /** What else the run has to say: a SkoolKit import's mismatches and renames. */
  notes?: string[];
};

const BANK_SIZE = 0x4000;
const HALF = 0x2000;
/** The bank spaces whose bank 5 (and 7 on the 128K family) hold the ULA screen. */
const SCREEN_BANKS: Record<string, readonly number[]> = {
  next: [5, 7],
  sp48: [5],
  sp128: [5, 7],
  plus3: [5, 7],
  scorpion: [5, 7],
  timex: [5]
};

export async function runDetection(
  ports: DetectionPorts,
  context: DetectionContext,
  request: DetectionRequest
): Promise<DetectionRun> {
  const touched = await ports.getProfileTouched(0xff);
  if (!touched || touched.bytes.length === 0) {
    return {
      targets: [],
      problem:
        "There is no coverage to detect from. Turn it on with `coverage on`, run the program, and " +
        "pause — or load a saved run with `coverage load <file>`."
    };
  }
  const flagsByOffset = new Map<number, number>();
  for (const b of touched.bytes) flagsByOffset.set(b.offset, b.flags);

  const memory = await ports.getMemoryContents();
  const slots: SlotPaging = memory.slotPartitions;
  const view64 = await ports.getProfileView().catch(() => undefined);
  const edges = request.reach ? await ports.getProfileEdges().catch(() => undefined) : undefined;

  const { bankSpace } = context;
  const targets: DetectionTarget[] = [];
  const pagedBanks = new Set<number>();
  for (let address = 0; address < 0x10000; address += HALF) {
    const site = bankSpace.siteAt(address, slots);
    if (site?.kind === "bank") pagedBanks.add(site.bank);
  }

  let banks: number[] = [];
  switch (request.scope.kind) {
    case "paged":
      banks = [...pagedBanks];
      break;
    case "bank":
      banks = [request.scope.bank];
      break;
    case "all":
      banks = bankSpace.ramBanks.filter((bank) => bankHasCoverage(context, bank, flagsByOffset));
      break;
  }

  if (request.scope.kind !== "rom" && !context.activeSet) {
    return { targets: [], problem: "No annotation set is active: use ann-new, or open a project." };
  }

  for (const bank of banks) {
    const evidence = await readBankEvidence(ports, context, memory, slots, bank, flagsByOffset);
    if (!evidence) continue;
    const write: LiveRowTarget = {
      kind: "bank",
      annotationPath: context.activeSet!.path,
      bank,
      offset: 0,
      disassOffset: evidence.base,
      create: { machine: context.activeSet!.machine, offsetIndex: bankSpace.defaultOffsetIndex(bank) },
      destination: context.activeSet!.path.split(/[\\/]/).pop() ?? context.activeSet!.path
    };
    const screen = request.screen && SCREEN_BANKS[bankSpace.id]?.includes(bank) ? { ...SCREEN_AREA_RANGE } : undefined;
    targets.push(
      await detectOne({
        name: `bank ${bank}`,
        write,
        evidence,
        request,
        context,
        edges,
        view64,
        screen,
        stackOffset: siteOffsetIn(bankSpace, memory.sp, slots, bank),
        pcOffset: siteOffsetIn(bankSpace, memory.pc, slots, bank),
        instructionLength: undefined
      })
    );
  }

  if (request.scope.kind === "rom") {
    const site = bankSpace.siteAt(0, slots);
    if (!site || site.kind !== "rom") return { targets: [], problem: "No ROM is paged in at $0000." };
    const write = liveRowTarget(0, { bankSpace, slots, activeSet: context.activeSet, romPartition: context.romPartition });
    if (!("annotationPath" in write)) return { targets: [], problem: write.disabledReason };
    const evidence = readRomEvidence(context, memory, site.partition, flagsByOffset);
    targets.push(
      await detectOne({
        name: "ROM",
        write,
        evidence,
        request,
        context,
        edges,
        view64,
        stackOffset: undefined,
        pcOffset: memory.pc < BANK_SIZE ? memory.pc : undefined,
        instructionLength: context.isBasic48Rom(site.partition) ? spectrumRomInstructionLength : undefined
      })
    );
  }

  return targets.length > 0 ? { targets } : { targets, problem: "No bank to detect in." };
}

type Evidence = {
  bytes: Uint8Array;
  flags: Uint8Array;
  /** Profile offset → bank offset, for the call edges. */
  offsetOfProfile: Map<number, number>;
  /** The address bank offset 0 is listed at in the walk's 64K view. */
  base: number;
  bankOffsetOf: (address: number) => number | undefined;
  addressOf: (offset: number) => number;
};

/** Whether any byte of a bank was touched: `ann-detect all` proposes only for those. */
function bankHasCoverage(context: DetectionContext, bank: number, flags: Map<number, number>): boolean {
  // --- Profile offsets run contiguously through each 8K half of a bank (a page, a 16K bank, a
  // --- fixed address range), so one lookup per half is enough
  for (const half of [0, HALF]) {
    const start = profileOffsetOfBank(context, bank, half);
    if (start === undefined) continue;
    for (let i = 0; i < HALF; i++) if (flags.has(start + i)) return true;
  }
  return false;
}

function profileOffsetOfBank(context: DetectionContext, bank: number, offset: number): number | undefined {
  const { bankSpace, layout } = context;
  const site = { bank, offset };
  const partition = layout.regions.length > 0 ? bankSpace.partitionOf(site) : undefined;
  const address = bankSpace.candidateAddresses(site)[0] ?? offset;
  return profileOffsetOf(layout, partition, address);
}

async function readBankEvidence(
  ports: DetectionPorts,
  context: DetectionContext,
  memory: MemoryInfo,
  slots: SlotPaging,
  bank: number,
  flagsByOffset: Map<number, number>
): Promise<Evidence | undefined> {
  const { bankSpace } = context;
  const bytes = await readBankBytes(ports, bankSpace, memory, slots, bank);
  if (!bytes) return undefined;
  const flags = new Uint8Array(BANK_SIZE);
  const offsetOfProfile = new Map<number, number>();
  for (const half of [0, HALF]) {
    const start = profileOffsetOfBank(context, bank, half);
    if (start === undefined) continue;
    for (let i = 0; i < HALF; i++) {
      offsetOfProfile.set(start + i, half + i);
      flags[half + i] = flagsByOffset.get(start + i) ?? 0;
    }
  }

  // --- The walk's 64K view: the paging now when the bank is paged, else its default slot
  const pagedAt = bankSpace.addressesOf({ bank, offset: 0 }, slots)[0];
  if (pagedAt !== undefined) {
    return {
      bytes,
      flags,
      offsetOfProfile,
      base: pagedAt,
      bankOffsetOf: (address) => {
        const site = bankSpace.siteAt(address & 0xffff, slots);
        return site?.kind === "bank" && site.bank === bank ? site.offset : undefined;
      },
      addressOf: (offset) => bankSpace.addressesOf({ bank, offset }, slots)[0] ?? (pagedAt + offset) & 0xffff
    };
  }
  const base = bankSpace.defaultOffsetIndex(bank) * BANK_SIZE;
  return {
    bytes,
    flags,
    offsetOfProfile,
    base,
    bankOffsetOf: (address) => (address >= base && address < base + BANK_SIZE ? address - base : undefined),
    addressOf: (offset) => base + offset
  };
}

/**
 * A RAM bank's 16K as it is in the machine now: each 8K half from where it is paged, or from its
 * partition when it is not (a Next bank is two 8K partitions, D-T7). `undefined` when a half is
 * neither paged nor readable as a partition.
 */
export async function readBankBytes(
  ports: Pick<DetectionPorts, "getMemoryContents">,
  bankSpace: BankSpace,
  memory: MemoryInfo,
  slots: SlotPaging,
  bank: number
): Promise<Uint8Array | undefined> {
  const bytes = new Uint8Array(BANK_SIZE);
  for (const half of [0, HALF]) {
    const site = { bank, offset: half };
    const addresses = bankSpace.addressesOf(site, slots);
    if (addresses.length > 0) {
      bytes.set(memory.memory.subarray(addresses[0], addresses[0] + HALF), half);
      continue;
    }
    const partition = bankSpace.partitionOf(site);
    if (partition === undefined) return undefined;
    const contents = (await ports.getMemoryContents(partition)).memory;
    const from = contents.length >= BANK_SIZE ? half : 0;
    bytes.set(contents.subarray(from, from + HALF), half);
  }
  return bytes;
}

function readRomEvidence(
  context: DetectionContext,
  memory: MemoryInfo,
  partition: number,
  flagsByOffset: Map<number, number>
): Evidence {
  const { layout } = context;
  const bytes = memory.memory.slice(0, BANK_SIZE);
  const flags = new Uint8Array(BANK_SIZE);
  const offsetOfProfile = new Map<number, number>();
  const hasPartitions = layout.regions.length > 0;
  for (let offset = 0; offset < BANK_SIZE; offset++) {
    const po = profileOffsetOf(layout, hasPartitions ? partition : undefined, offset);
    if (po === undefined) continue;
    // --- A ROM smaller than 16K (the ZX81's 8K) mirrors: only its own bytes count
    if (!offsetOfProfile.has(po)) offsetOfProfile.set(po, offset);
    flags[offset] = flagsByOffset.get(po) ?? 0;
  }
  return {
    bytes,
    flags,
    offsetOfProfile,
    base: 0,
    bankOffsetOf: (address) => (address < BANK_SIZE ? address : undefined),
    addressOf: (offset) => offset
  };
}

function siteOffsetIn(space: BankSpace, address: number, slots: SlotPaging, bank: number): number | undefined {
  const site = space.siteAt(address & 0xffff, slots);
  return site?.kind === "bank" && site.bank === bank ? site.offset : undefined;
}

async function detectOne(args: {
  name: string;
  write: LiveRowTarget;
  evidence: Evidence;
  request: DetectionRequest;
  context: DetectionContext;
  edges: ProfileEdges | undefined;
  view64: ProfileView | undefined;
  screen?: { start: number; end: number };
  stackOffset: number | undefined;
  pcOffset: number | undefined;
  instructionLength: ((bytes: ArrayLike<number>, offset: number) => number | undefined) | undefined;
}): Promise<DetectionTarget> {
  const { evidence, request, write } = args;
  const current = await annotationsAt(write.annotationPath, args.context.projectService);
  const bankAnnotation: BankAnnotation | undefined = current?.banks[String(write.bank)];

  let reach: ReturnType<typeof reachBank> | undefined;
  if (request.reach) {
    const seeds: number[] = [];
    for (let i = 0; i < BANK_SIZE; i++) if (evidence.flags[i] & PF_EXECUTED) seeds.push(i);
    for (const edge of args.edges?.edges ?? []) {
      if (edge.callee >= PROFILE_KEY_UNMAPPED) continue;
      const offset = evidence.offsetOfProfile.get(edge.callee);
      if (offset !== undefined) seeds.push(offset);
    }
    // --- Labels in code regions, and the program counter
    for (const label of bankAnnotation?.localLabels ?? []) {
      const region = bankAnnotation!.regions.find((r) => label.value >= r.start && label.value <= r.end);
      if (!region || region.type === "disassemble") seeds.push(label.value);
    }
    if (args.pcOffset !== undefined) seeds.push(args.pcOffset);
    reach = reachBank({
      bytes: evidence.bytes,
      flags: evidence.flags,
      z80n: args.context.bankSpace.extendedSet,
      seeds,
      bankOffsetOf: evidence.bankOffsetOf,
      addressOf: evidence.addressOf,
      instructionLength: args.instructionLength
    });
  }

  const options: DetectOptions = {
    unknown: request.unknown,
    text: request.text,
    words: request.words,
    ...(args.screen ? { screen: args.screen } : {}),
    ...(args.stackOffset !== undefined ? { stackOffset: args.stackOffset } : {})
  };
  const view = args.view64?.flags;
  const classified = classifyBank({
    flags: evidence.flags,
    bytes: evidence.bytes,
    z80n: args.context.bankSpace.extendedSet,
    reach,
    instructionLength: args.instructionLength,
    isCodePointer: (value) => !!view && (view[value & 0xffff] & PF_EXECUTED) !== 0,
    options
  });
  const warnings = [
    ...classified.warnings,
    ...(reach?.conflicts ?? []).map((c) => ({
      offset: c.offset,
      kind: c.kind === "data" ? ("data-conflict" as const) : ("overlap" as const),
      message:
        c.kind === "data"
          ? "Reachable code runs into bytes observed as data."
          : "Reachable code lands inside another instruction."
    }))
  ];
  return {
    name: args.name,
    write,
    proposal: proposeForBank({
      bank: write.bank,
      bankAnnotation,
      runs: classified.runs,
      warnings,
      mode: request.mode
    })
  };
}

/** The annotations a sidecar holds now: the session's copy, or the file. */
async function annotationsAt(
  path: string,
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">
): Promise<ProgramAnnotations | undefined> {
  const live = peekAnnotationSession(path);
  if (live) return live;
  const state = await loadAnnotationSidecar(projectService, { fullPath: path });
  return state.status === "loaded" ? state.annotations : undefined;
}

// ─── Apply and undo ──────────────────────────────────────────────────────────

/** The models before the last apply, by sidecar: what *Undo last detection* restores. */
let lastApplied: { path: string; before: ProgramAnnotations }[] | undefined;

/**
 * Apply the included targets: one session update per sidecar. Banks and sidecars that do not exist
 * yet are created first, as the first edit of any annotation creates them.
 */
export async function applyDetection(
  targets: readonly DetectionTarget[],
  context: Pick<DetectionContext, "projectService" | "bankSpace">
): Promise<{ written: string[]; problems: string[] }> {
  const byPath = new Map<string, DetectionTarget[]>();
  for (const target of targets) {
    byPath.set(target.write.annotationPath, [...(byPath.get(target.write.annotationPath) ?? []), target]);
  }
  const undo: { path: string; before: ProgramAnnotations }[] = [];
  const written: string[] = [];
  const problems: string[] = [];
  for (const [path, group] of byPath) {
    let created: ProgramAnnotations | undefined;
    for (const target of group) {
      created = await ensureAnnotatedBank(target.write, context.projectService);
      if (!created) break;
    }
    if (!created) {
      problems.push(`${path} cannot be read, so nothing was written to it.`);
      continue;
    }
    const before = peekAnnotationSession(path) ?? created;
    undo.push({ path, before });
    const offsetIndex = (bank: number) => context.bankSpace.defaultOffsetIndex(bank);
    let after = applyProposals(
      before,
      group.filter((t) => !t.skool).map((t) => t.proposal),
      offsetIndex
    );
    for (const target of group) {
      if (target.skool) after = applySkoolBank(after, target.skool, target.proposal, offsetIndex);
    }
    updateAnnotationSession(path, after, context.projectService);
    await flushAnnotationSession(path);
    written.push(path);
  }
  if (undo.length > 0) lastApplied = undo;
  return { written, problems };
}

/** Whether there is a detection to undo in this session. */
export function canUndoDetection(): boolean {
  return !!lastApplied?.length;
}

/** Put back the annotations from before the last apply. */
export async function undoLastDetection(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">
): Promise<string[]> {
  const undo = lastApplied ?? [];
  lastApplied = undefined;
  for (const { path, before } of undo) {
    updateAnnotationSession(path, before, projectService);
    await flushAnnotationSession(path);
  }
  return undo.map((u) => u.path);
}

/** For tests. */
export function resetDetectionForTests(): void {
  lastApplied = undefined;
}


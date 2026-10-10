import type {
  AnnotationRegion,
  AnnotationRegionType,
  BankAnnotation,
  ProgramAnnotations
} from "@renderer/appIde/annotations/programAnnotations";
import { DEFAULT_REGION } from "@renderer/appIde/annotations/programAnnotations";
import {
  mergeAnnotationRegions,
  pruneGraphics,
  replaceAnnotationRegion
} from "@renderer/appIde/annotations/annotationEdits";
import { classifiedCounts, type ClassifiedRun, type ClassifyWarning, type Evidence } from "./classify";

/*
 * What a detection run (or a SkoolKit import) would change (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`
 * §4.3, R3).
 *
 * Proposes; never applies on its own. A run counts as a change only where it can be applied:
 *
 * - **fill** (the default): over a gap — a non-auto `disassemble` region, which is what an
 *   unannotated bank is (Q2) — or over a region detection wrote before (`origin: "auto"`). Any
 *   other region is the user's and is listed as a conflict, untouched.
 * - **replace**: the conflicts are changed too. The caller confirms first.
 * - **clear**: every region the writer wrote before goes back to the gap it filled.
 *
 * Applying writes `origin` on every region it creates, so it can be told apart, re-detected and
 * cleared later.
 */

export type ProposalMode = "fill" | "replace" | "clear";
export type ProposalOrigin = "auto" | "skool";

export type RegionChange = {
  start: number;
  end: number;
  type: AnnotationRegionType;
  evidence?: Evidence;
  /** What is there now. */
  from: AnnotationRegionType;
  /** The region there now is the user's: applied only in replace mode. */
  user?: boolean;
};

export type BankProposal = {
  bank: number;
  mode: ProposalMode;
  /** The changes applying will make. */
  changes: RegionChange[];
  /** The user regions the classification disagrees with (not changed in fill mode). */
  conflicts: RegionChange[];
  /** Bytes per evidence level, and per class. */
  counts: ReturnType<typeof classifiedCounts>;
  /** Bytes still unknown, and their share of the bank. */
  unknownBytes: number;
  unknownPercent: number;
  warnings: ClassifyWarning[];
  /** Notes worth a row in the proposal: SMC, the stack, the screen, interrupt code. */
  notedRuns: ClassifiedRun[];
};

const BANK_SIZE = 0x4000;

/** The regions of a bank, or the default gap when the bank has none yet. */
function regionsOf(bank: BankAnnotation | undefined): AnnotationRegion[] {
  return bank?.regions ?? [{ ...DEFAULT_REGION }];
}

/** Whether a region can be overwritten in fill mode by a writer of `origin`. */
function fillable(region: AnnotationRegion, origin: ProposalOrigin): boolean {
  return region.origin === origin || (region.type === "disassemble" && !region.origin);
}

export function proposeForBank(args: {
  bank: number;
  bankAnnotation: BankAnnotation | undefined;
  runs: readonly ClassifiedRun[];
  warnings?: readonly ClassifyWarning[];
  mode: ProposalMode;
  origin?: ProposalOrigin;
}): BankProposal {
  const origin = args.origin ?? "auto";
  const regions = regionsOf(args.bankAnnotation);
  const counts = classifiedCounts(args.runs);
  const base = {
    bank: args.bank,
    mode: args.mode,
    counts,
    unknownBytes: counts.unknown,
    unknownPercent: Math.round((counts.unknown * 1000) / BANK_SIZE) / 10,
    warnings: [...(args.warnings ?? [])],
    notedRuns: args.runs.filter((run) => run.notes?.length)
  };

  if (args.mode === "clear") {
    const changes: RegionChange[] = regions
      .filter((region) => region.origin === origin)
      .map((region) => ({ start: region.start, end: region.end, type: "disassemble" as const, from: region.type }));
    return { ...base, changes, conflicts: [] };
  }

  const changes: RegionChange[] = [];
  const conflicts: RegionChange[] = [];
  for (const run of args.runs) {
    if (!run.proposedType) continue;
    for (const region of regions) {
      const start = Math.max(run.start, region.start);
      const end = Math.min(run.end, region.end);
      if (start > end) continue;
      const already =
        region.type === run.proposedType &&
        (region.origin === origin || (run.proposedType === "disassemble" && !region.origin));
      if (already) continue;
      const change: RegionChange = { start, end, type: run.proposedType, evidence: run.evidence, from: region.type };
      if (fillable(region, origin)) {
        changes.push(change);
      } else {
        const conflict = { ...change, user: true };
        conflicts.push(conflict);
        if (args.mode === "replace") changes.push(conflict);
      }
    }
  }
  return { ...base, changes: mergeChanges(changes), conflicts: mergeChanges(conflicts) };
}

/** Join touching changes of one type, evidence and ownership, so the proposal lists fewer rows. */
function mergeChanges(changes: RegionChange[]): RegionChange[] {
  const sorted = [...changes].sort((a, b) => a.start - b.start);
  const merged: RegionChange[] = [];
  for (const change of sorted) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.end + 1 === change.start &&
      last.type === change.type &&
      last.evidence === change.evidence &&
      last.from === change.from &&
      !!last.user === !!change.user
    ) {
      last.end = change.end;
    } else {
      merged.push({ ...change });
    }
  }
  return merged;
}

/**
 * The annotations with the proposals applied: one model, so the caller publishes it as one session
 * update. A bank the model does not have yet is created with `offsetIndex` from `defaultOffsetIndex`.
 */
export function applyProposals(
  annotations: ProgramAnnotations,
  proposals: readonly BankProposal[],
  defaultOffsetIndex: (bank: number) => 0 | 1 | 2 | 3,
  origin: ProposalOrigin = "auto"
): ProgramAnnotations {
  const banks = { ...annotations.banks };
  for (const proposal of proposals) {
    const key = String(proposal.bank);
    const current: BankAnnotation = banks[key] ?? {
      offsetIndex: defaultOffsetIndex(proposal.bank),
      regions: [{ ...DEFAULT_REGION }]
    };
    let regions = current.regions;
    if (proposal.mode === "clear") {
      regions = mergeAnnotationRegions(
        regions.map((region) =>
          region.origin === origin ? { start: region.start, end: region.end, type: "disassemble" as const } : region
        )
      );
    } else {
      for (const change of proposal.changes) {
        regions = replaceAnnotationRegion(regions, change.start, change.end, change.type, { origin });
      }
    }
    banks[key] = pruneGraphics({ ...current, regions });
  }
  return { ...annotations, banks };
}

/** The proposal as plain text, for the command output and the result document. */
export function describeProposal(proposal: BankProposal, bankName: string): string[] {
  const lines: string[] = [];
  const { counts } = proposal;
  if (proposal.mode === "clear") {
    lines.push(`${bankName}: clears ${proposal.changes.length} detected region(s).`);
    return lines;
  }
  lines.push(
    `${bankName}: code ${counts.code} (observed ${counts.observed}, reached ${counts.reached}, inferred ${counts.inferred}), ` +
      `data ${counts.data}, unknown ${proposal.unknownBytes} (${proposal.unknownPercent}%). ` +
      `${proposal.changes.length} change(s), ${proposal.conflicts.length} conflict(s) with your regions.`
  );
  const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;
  for (const change of proposal.changes) {
    lines.push(
      `  ${hex(change.start)}-${hex(change.end)}  ${change.from} -> ${change.type}` +
        `${change.evidence ? ` (${change.evidence})` : ""}${change.user ? " [yours]" : ""}`
    );
  }
  if (proposal.mode === "fill") {
    for (const conflict of proposal.conflicts) {
      lines.push(`  ${hex(conflict.start)}-${hex(conflict.end)}  yours: ${conflict.from}, detected: ${conflict.type} (kept)`);
    }
  }
  for (const run of proposal.notedRuns) {
    lines.push(`  ${hex(run.start)}-${hex(run.end)}  note: ${run.notes!.join(", ")}`);
  }
  for (const warning of proposal.warnings.slice(0, 20)) {
    lines.push(`  ${hex(warning.offset)}  warning: ${warning.message}`);
  }
  if (proposal.warnings.length > 20) lines.push(`  ... ${proposal.warnings.length - 20} more warning(s)`);
  return lines;
}

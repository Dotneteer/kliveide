/*
 * The Copper views' model: everything the Copper side-bar panel and the Copper List document show,
 * computed from one `CopperState` snapshot, with no React and no I/O
 * (`.plans/COPPER_DEBUGGING_PLAN.md` §4.4, §4.5).
 */
import type { CopperHitEvent, CopperState } from "@common/messaging/EmuApi";
import {
  analyzeCopperList,
  COPPER_LIST_LENGTH,
  type CopperInstruction,
  type CopperListSummary,
  type CopperTiming,
  decodeCopperList,
  formatCopperIndex,
  isCopperWaitPark
} from "@common/zxnext/copper/copperDecoder";
import { getNextRegDescriptor } from "@emu/machines/zxNext/nextRegDescriptors";

/** The paper is `cvc` 0-191. */
export const COPPER_PAPER_LINES = 192;

/** The decoded list and its analysis, for one snapshot. */
export type CopperModel = {
  state: CopperState;
  list: CopperInstruction[];
  summary: CopperListSummary;
  timing: CopperTiming;
};

export function buildCopperModel(state: CopperState): CopperModel {
  const list = decodeCopperList(state.ram);
  const timing = { lines: state.timing.lines, hcs: state.timing.hcs };
  return { state, list, summary: analyzeCopperList(list, timing), timing };
}

// ---------------------------------------------------------------------------------------------
// Mode and state
// ---------------------------------------------------------------------------------------------

const MODE_PHRASES = [
  "00 · stopped",
  "01 · loop from index 0",
  "10 · loop, resume at last point",
  "11 · loop, restart at (0,0)"
];

/** `11 · loop, restart at (0,0)`: the `$62` start mode as a short phrase. */
export function copperModeText(startMode: number): string {
  return MODE_PHRASES[startMode & 0x03];
}

/** The `$62` descriptor's full text for the mode, for a tooltip. */
export function copperModeTooltip(startMode: number): string {
  const slice = getNextRegDescriptor(0x62)?.slices?.[0];
  const text = slice?.valueSet?.[startMode & 0x03];
  return `NextReg $62 bits 7-6 = ${((startMode & 0x03) >>> 0).toString(2).padStart(2, "0")}${
    text ? `\n${text}` : ""
  }`;
}

/**
 * What the Copper is doing: `Stopped`, `Stopped · list retained` (a soft reset keeps the list RAM,
 * trap T9), `Waiting for line 96, x 64`, `Running`, or `Halted at $011`.
 */
export function copperStateText(model: CopperModel): string {
  const { state, list, summary } = model;
  if ((state.startMode & 0x03) === 0) {
    return summary.usedLength > 0 ? "Stopped · list retained" : "Stopped";
  }
  const current = list[state.pc & 0x3ff];
  if (current.kind === "halt") return `Halted at ${formatCopperIndex(current.index)}`;
  if (current.kind === "wait" && state.beam.waiting) {
    return isCopperWaitPark(current, model.timing)
      ? `Parked at ${formatCopperIndex(current.index)} (never matches)`
      : `Waiting for line ${current.line}, x ${current.paperX}`;
  }
  return "Running";
}

/** `22 used · HALT at $015 · 1002 NOP`, or `no HALT` when the list does not end in one (D15). */
export function copperSummaryText(summary: CopperListSummary): string {
  if (summary.usedLength === 0) return "empty";
  const parts = [`${summary.usedLength} used`];
  parts.push(summary.terminated ? `HALT at ${formatCopperIndex(summary.haltIndex!)}` : "no HALT");
  if (summary.trailingNops > 0) parts.push(`${summary.trailingNops} NOP`);
  return parts.join(" · ");
}

/** Warnings worth showing beside the summary: no HALT, never-matching WAITs, out-of-order WAITs. */
export function copperWarnings(summary: CopperListSummary): string[] {
  const warnings: string[] = [];
  if (summary.usedLength > 0 && !summary.terminated) {
    warnings.push("The list does not end in a HALT: the Copper runs on into the rest of its RAM.");
  }
  if (summary.parks.length) {
    warnings.push(
      `WAIT${summary.parks.length > 1 ? "s" : ""} at ${summary.parks.map(formatCopperIndex).join(", ")} never match${
        summary.parks.length > 1 ? "" : "es"
      } under the current timing.`
    );
  }
  if (summary.orderWarnings.length) {
    warnings.push(
      `WAIT${summary.orderWarnings.length > 1 ? "s" : ""} at ${summary.orderWarnings
        .map(formatCopperIndex)
        .join(", ")} wait${summary.orderWarnings.length > 1 ? "" : "s"} for an earlier line than the WAIT before: in a looping mode that is the next frame.`
    );
  }
  return warnings;
}

// ---------------------------------------------------------------------------------------------
// The side-bar window
// ---------------------------------------------------------------------------------------------

/** The first index of a `size`-row window centred on the PC, clamped to the list. */
export function copperWindowStart(pc: number, size = 7): number {
  const half = Math.floor(size / 2);
  return Math.max(0, Math.min(COPPER_LIST_LENGTH - size, (pc & 0x3ff) - half));
}

/** The window's instructions. */
export function copperWindow(model: CopperModel, size = 7): CopperInstruction[] {
  const start = copperWindowStart(model.state.pc, size);
  return model.list.slice(start, start + size);
}

// ---------------------------------------------------------------------------------------------
// The Copper List rows
// ---------------------------------------------------------------------------------------------

export type CopperListRow =
  | { kind: "instr"; instr: CopperInstruction }
  /** The trailing run of zero words, collapsed into one row (§4.5) */
  | { kind: "nops"; from: number; count: number };

/**
 * The table's rows: every used instruction, then the trailing NOPs as one collapsed row unless
 * `expanded`. An index the view must show (the PC, the hit, a revealed slot) inside the collapsed
 * run expands it.
 */
export function copperListRows(
  model: CopperModel,
  expanded: boolean,
  mustShow: (number | undefined)[] = []
): CopperListRow[] {
  const { list, summary } = model;
  const used = summary.usedLength;
  const showAll =
    expanded || summary.trailingNops <= 1 || mustShow.some((i) => i !== undefined && i >= used);
  if (showAll) return list.map((instr) => ({ kind: "instr" as const, instr }));
  const rows: CopperListRow[] = list.slice(0, used).map((instr) => ({ kind: "instr" as const, instr }));
  rows.push({ kind: "nops", from: used, count: summary.trailingNops });
  return rows;
}

/** `1002 × NOP ($016–$3FF)` */
export function copperNopsText(from: number, count: number): string {
  return `${count} × NOP (${formatCopperIndex(from)}–${formatCopperIndex(from + count - 1)})`;
}

/** The row index that shows list index `index`, or -1. */
export function copperRowOf(rows: CopperListRow[], index: number): number {
  return rows.findIndex((r) =>
    r.kind === "instr" ? r.instr.index === index : index >= r.from && index < r.from + r.count
  );
}

// ---------------------------------------------------------------------------------------------
// The raster ruler
// ---------------------------------------------------------------------------------------------

export type RulerZone = { kind: "paper" | "lower" | "upper"; from: number; to: number };

export type RulerTick = {
  index: number;
  line: number;
  /** False for a WAIT that never matches under the timing (trap T5) */
  matches: boolean;
};

export type CopperRuler = {
  /** `cvc` lines in the frame */
  lines: number;
  zones: RulerZone[];
  ticks: RulerTick[];
  /** The live beam line */
  beamLine?: number;
  /** The hit's line, when stopped on a Copper breakpoint */
  hitLine?: number;
};

/**
 * The ruler: shaded zones in `cvc` order (paper, then the lower border and blanking, then the upper
 * border, which is the frame's last lines because `cvc` 0 is the first paper line), a tick per WAIT
 * of the used list, the beam, and the hit (trap T4: lines from the core's live timing, never 311).
 */
export function copperRuler(model: CopperModel, lastHit?: CopperHitEvent): CopperRuler {
  const lines = Math.max(1, model.timing.lines);
  const paperEnd = Math.min(COPPER_PAPER_LINES, lines);
  const upper = Math.max(0, Math.min(model.state.timing.upperBorder ?? 0, lines - paperEnd));
  const zones: RulerZone[] = [{ kind: "paper", from: 0, to: paperEnd }];
  if (lines - upper > paperEnd) zones.push({ kind: "lower", from: paperEnd, to: lines - upper });
  if (upper > 0) zones.push({ kind: "upper", from: lines - upper, to: lines });

  const ticks: RulerTick[] = [];
  const end = model.summary.terminated ? model.summary.haltIndex! : model.summary.usedLength;
  for (let i = 0; i < end; i++) {
    const instr = model.list[i];
    if (instr.kind !== "wait") continue;
    ticks.push({ index: i, line: instr.line, matches: !isCopperWaitPark(instr, model.timing) });
  }
  return {
    lines,
    zones,
    ticks,
    beamLine: model.state.startMode ? model.state.beam.line : undefined,
    hitLine: lastHit?.line
  };
}

/** A `cvc` line's vertical position on a ruler `height` pixels tall; past-the-frame lines clamp. */
export function rulerY(line: number, lines: number, height: number): number {
  return (Math.min(Math.max(line, 0), lines - 1) / Math.max(1, lines)) * height;
}

/** The tick nearest to a vertical position, within `tolerance` pixels, for hover and click. */
export function rulerTickAt(
  ruler: CopperRuler,
  y: number,
  height: number,
  tolerance = 3
): RulerTick | undefined {
  let best: RulerTick | undefined;
  let bestDistance = Infinity;
  for (const tick of ruler.ticks) {
    const d = Math.abs(rulerY(tick.line, ruler.lines, height) - y);
    if (d <= tolerance && d < bestDistance) {
      best = tick;
      bestDistance = d;
    }
  }
  return best;
}

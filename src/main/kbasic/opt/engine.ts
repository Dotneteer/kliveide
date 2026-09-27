import type { LirLine } from "../backend/lir";
import { computeLiveness, type Liveness } from "./liveness";
import type { ParsedInstr } from "./lir";

/**
 * The peephole rule engine (`.docs/kbasic-optimiser.md` §4.2). Rules are data: each looks at the
 * lines from a position and may propose to replace a window of them. The engine, not the rule,
 * decides whether the window may be touched, so no rule can break what the debugger relies on:
 *
 * - a window never contains a marker (`stmt`, `prologue.end`, `epilogue.begin`) — statement entries
 *   and frame boundaries stay where they are (G1, and the frame locator's bodyStart/epilogueStart);
 * - a window never contains a pinned line: a call with a call-site record (G5), the code of an
 *   inline-asm statement (the user's own), the prologue and the epilogue (the frame and G6), glue
 *   other than jumps;
 * - at level 1 every line of a window belongs to one statement (statement boundaries are barriers).
 *
 * Rules run to a fixed point per function; liveness is recomputed after every change.
 */
export type RuleContext = {
  lines: LirLine[];
  /** Indices into `lines` of the lines that are not comments: rules see only these. */
  view: number[];
  live: Liveness;
  /** How many jumps in the function name each label. */
  labelRefs: Map<string, number>;
  level: number;
  target: "z80" | "z80n";
};

export type RuleMatch = {
  /** How many `view` entries the replacement covers, from the matched position. */
  length: number;
  replace: LirLine[];
};

export type Rule = {
  name: string;
  /** The lowest level it runs at. */
  level: 1 | 2 | 3;
  targets?: ("z80" | "z80n")[];
  match: (ctx: RuleContext, at: number) => RuleMatch | undefined;
};

export type EngineOptions = {
  level: number;
  target: "z80" | "z80n";
  /** Statement ids whose code is the user's inline asm: never touched. */
  asmStatements: ReadonlySet<number>;
  /** Called for every rule that fires (tests and statistics). */
  onFire?: (rule: string) => void;
};

/** Runs the rules over one function's LIR to a fixed point. */
export function runRules(fn: LirLine[], rules: readonly Rule[], options: EngineOptions): LirLine[] {
  const active = rules.filter((r) => r.level <= options.level && (!r.targets || r.targets.includes(options.target)));
  let lines = fn;
  for (let guard = 0; guard < 100000; guard++) {
    const ctx = context(lines, options);
    const pinned = pinnedLines(lines, options.asmStatements);
    let fired = false;
    outer: for (let v = 0; v < ctx.view.length; v++) {
      for (const rule of active) {
        const m = rule.match(ctx, v);
        if (!m || !windowAllowed(ctx, pinned, v, m.length, options.level)) continue;
        const from = ctx.view[v];
        const to = ctx.view[v + m.length - 1];
        lines = [...lines.slice(0, from), ...m.replace, ...lines.slice(to + 1)];
        options.onFire?.(rule.name);
        fired = true;
        break outer;
      }
    }
    if (!fired) return lines;
  }
  return lines;
}

function context(lines: LirLine[], options: EngineOptions): RuleContext {
  const view: number[] = [];
  lines.forEach((l, i) => l.kind !== "comment" && view.push(i));
  const labelRefs = new Map<string, number>();
  const live = computeLiveness(lines, options.level <= 1);
  live.parsed.forEach((p) => {
    const t = p?.branch?.target;
    if (t) labelRefs.set(t, (labelRefs.get(t) ?? 0) + 1);
  });
  return { lines, view, live, labelRefs, level: options.level, target: options.target };
}

/** Lines no rule may touch (see the header). */
function pinnedLines(lines: LirLine[], asmStatements: ReadonlySet<number>): boolean[] {
  const hasPrologue = lines.some((l) => l.kind === "marker" && l.marker === "prologue.end");
  let inPrologue = hasPrologue;
  let inEpilogue = false;
  return lines.map((l) => {
    if (l.kind === "marker") {
      if (l.marker === "prologue.end") inPrologue = false;
      if (l.marker === "epilogue.begin") inEpilogue = true;
      return true;
    }
    if (inPrologue || inEpilogue) return true;
    if (asmStatements.has(l.sid)) return true;
    if (l.kind === "instr" && l.site) return true;
    if (l.sid < 0 && l.kind === "instr" && !/^\s*jp\s/.test(l.text)) return true;
    return false;
  });
}

function windowAllowed(ctx: RuleContext, pinned: boolean[], at: number, length: number, level: number): boolean {
  if (length < 1 || at + length > ctx.view.length) return false;
  let sid: number | undefined;
  for (let k = at; k < at + length; k++) {
    const i = ctx.view[k];
    const line = ctx.lines[i];
    if (line.kind === "marker" || pinned[i]) return false;
    if (level <= 1) {
      // --- Only instructions count: labels hold no code, and glue jumps (sid -1) belong to no
      // --- statement; statement entries themselves are markers, which no window holds
      if (line.kind === "instr" && line.sid >= 0) {
        if (sid === undefined) sid = line.sid;
        else if (sid !== line.sid) return false;
      }
    }
  }
  return true;
}

// =================================================================================================
// Helpers for rules

/** The line at view position `at` (undefined past the end). */
export function lineAt(ctx: RuleContext, at: number): LirLine | undefined {
  const i = ctx.view[at];
  return i === undefined ? undefined : ctx.lines[i];
}

/** The parsed instruction at view position `at`, if that line is an instruction. */
export function instrAt(ctx: RuleContext, at: number): ParsedInstr | undefined {
  const i = ctx.view[at];
  return i === undefined ? undefined : ctx.live.parsed[i];
}

/** Registers live after view position `at`. */
export function liveAfter(ctx: RuleContext, at: number) {
  return ctx.live.liveOut[ctx.view[at]];
}

/** The statement id of the line at view position `at`. */
export function sidAt(ctx: RuleContext, at: number): number {
  return lineAt(ctx, at)?.sid ?? -1;
}

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { effectiveHitMode, hasBreakpointFilters, isLogpoint } from "@common/utils/breakpoint-filters";
import { isAnnotationBreakpoint } from "@common/utils/breakpoint-scope";
import { logGroupOf } from "@common/utils/breakpoint-condition/logpoint-template";
import { kliveConditionText } from "@common/utils/breakpoint-condition/dezog/dezog-printer";

/*
 * How a breakpoint's condition, hit rule and their runtime state read to a person - one wording for
 * the Breakpoints panel, the disassembly gutter and the editor margin
 * (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.4.2, §4.9).
 */

/** Draw the conditional glyph (the dot with an "=")? */
export function isConditionalBreakpoint(bp: BreakpointInfo | undefined): boolean {
  return !!bp && hasBreakpointFilters(bp);
}

/**
 * Draw the inactive glyph (the hollow dot)? A missing label (C14) - and a condition that failed to
 * arm (C15), which stops every time, so the hollow dot says "this is not doing what you wrote".
 */
export function isInactiveBreakpoint(bp: BreakpointInfo | undefined): boolean {
  return !!bp && (!!bp.conditionInactive || !!bp.conditionError);
}

/**
 * The glyph a breakpoint draws (`.plans/LOGPOINTS_PLAN.md` §4.5): a dot for one that stops, a
 * diamond for a logpoint (the VS Code convention), each with the conditional ("=") and inactive
 * (hollow) variants; and a hollow diamond with a centre dot for a `LOGPOINT` comment - read-only,
 * owned by the build. Shape only: the colour still says which kind of breakpoint and whether it can
 * resolve.
 */
export type BreakpointGlyph =
  | "dot"
  | "conditional"
  | "inactive"
  | "logpoint"
  | "logpointConditional"
  | "logpointInactive"
  | "logpointComment"
  | "once"
  | "onceConditional"
  | "assertion"
  | "watchpoint";

/**
 * A one-shot (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` O6) draws the dot with a "1" knocked
 * out, or - with a condition or hit rule - the "1" over a single bar. **Inactive (hollow) still
 * wins**: whether a breakpoint can fire at all matters most. An `ASSERTION` or `WPMEM` comment
 * draws its own mark (S12).
 */
export function breakpointGlyphOf(bp: BreakpointInfo | undefined): BreakpointGlyph {
  if (!bp) return "dot";
  if (isAnnotationBreakpoint(bp)) {
    if (bp.annotationKind === "ASSERTION") return "assertion";
    if (bp.annotationKind === "WPMEM") return "watchpoint";
    return "logpointComment";
  }
  const inactive = isInactiveBreakpoint(bp) || !!bp.logError;
  if (isLogpoint(bp)) {
    return inactive ? "logpointInactive" : isConditionalBreakpoint(bp) ? "logpointConditional" : "logpoint";
  }
  if (inactive) return "inactive";
  if (bp.oneShot) return isConditionalBreakpoint(bp) ? "onceConditional" : "once";
  return isConditionalBreakpoint(bp) ? "conditional" : "dot";
}

/** The icon (`src/renderer/assets/icons`) of a glyph. */
export function breakpointGlyphIcon(glyph: BreakpointGlyph): string {
  switch (glyph) {
    case "conditional":
      return "bp-conditional";
    case "inactive":
      return "bp-inactive";
    case "logpoint":
      return "bp-logpoint";
    case "logpointConditional":
      return "bp-logpoint-conditional";
    case "logpointInactive":
      return "bp-logpoint-inactive";
    case "logpointComment":
      return "bp-logpoint-comment";
    case "once":
      return "bp-once";
    case "onceConditional":
      return "bp-once-conditional";
    case "assertion":
      return "bp-assertion";
    case "watchpoint":
      return "bp-mem-write";
    default:
      return "circle-filled";
  }
}

/** The hit rule in words: "Stops on every 4th hit". `undefined` without a rule. */
export function describeHitRule(bp: BreakpointInfo): string | undefined {
  const n = bp.hitCount;
  switch (effectiveHitMode(bp)) {
    case "eq":
      return `Stops on hit ${n}`;
    case "gt":
      return `Stops after hit ${n}`;
    case "ge":
      return `Stops from hit ${n} on`;
    case "lt":
      return `Stops before hit ${n}`;
    case "le":
      return `Stops up to hit ${n}`;
    case "every":
      return n === 1 ? "Stops on every hit" : `Stops on every ${ordinal(n!)} hit`;
    default:
      return undefined;
  }
}

/** The tooltip lines about a breakpoint's filters and their state; empty for a plain one. */
export function breakpointFilterLines(bp: BreakpointInfo): string[] {
  const lines: string[] = [];
  if (isLogpoint(bp)) {
    if (isAnnotationBreakpoint(bp)) {
      lines.push("From a LOGPOINT comment - edit the comment and rebuild to change it, or disable it");
    }
    lines.push(`Logs: ${bp.logMessage}`);
    lines.push(`Group: ${logGroupOf(bp.logMessage)}`);
    if (isAnnotationBreakpoint(bp) && bp.address !== undefined) {
      lines.push(`At: $${bp.address.toString(16).toUpperCase().padStart(4, "0")}`);
    }
  }
  if (bp.oneShot && !bp.runTo) lines.push("One-shot: removed after it stops");
  if (bp.runTo) lines.push("Run-to target: removed when the machine gets there");
  if (bp.annotationKind === "ASSERTION") {
    lines.push("From an ASSERTION comment - stops when the expression is false");
    lines.push(`Asserts: ${bp.annotationText || "false (always stops)"}`);
    if (bp.annotationText) lines.push(`Read as: ${kliveConditionText(bp.annotationText)}`);
  } else if (bp.annotationKind === "WPMEM") {
    lines.push(`From a WPMEM comment: ${bp.annotationText ? `WPMEM ${bp.annotationText}` : "WPMEM"}`);
  }
  if (bp.condition?.trim() && !bp.annotationKind) lines.push(`Condition: ${bp.condition.trim()}`);
  const rule = describeHitRule(bp);
  if (rule) lines.push(rule);
  if (bp.currentHits !== undefined && (bp.condition?.trim() || rule || isLogpoint(bp))) {
    lines.push(`Hits so far: ${bp.currentHits}`);
  }
  if (bp.conditionInactive) {
    lines.push(`Inactive: ${bp.conditionInactive} - it will not stop until a build defines it`);
  }
  if (bp.conditionError) {
    lines.push(`Condition error (${bp.conditionError}) - it stops every time`);
  }
  if (bp.logError) {
    lines.push(`Log message error (${bp.logError}) - it logs the error instead`);
  }
  return lines;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { effectiveHitMode, hasBreakpointFilters } from "@common/utils/breakpoint-filters";

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
  if (bp.condition?.trim()) lines.push(`Condition: ${bp.condition.trim()}`);
  const rule = describeHitRule(bp);
  if (rule) lines.push(rule);
  if (bp.currentHits !== undefined && (bp.condition?.trim() || rule)) {
    lines.push(`Hits so far: ${bp.currentHits}`);
  }
  if (bp.conditionInactive) {
    lines.push(`Inactive: ${bp.conditionInactive} - it will not stop until a build defines it`);
  }
  if (bp.conditionError) {
    lines.push(`Condition error (${bp.conditionError}) - it stops every time`);
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

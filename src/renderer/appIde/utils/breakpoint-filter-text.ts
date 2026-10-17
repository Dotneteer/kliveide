import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { effectiveHitMode, hasBreakpointFilters, isLogpoint } from "@common/utils/breakpoint-filters";
import { isAnnotationBreakpoint } from "@common/utils/breakpoint-scope";
import { logGroupOf } from "@common/utils/breakpoint-condition/logpoint-template";
import { kliveConditionText } from "@common/utils/breakpoint-condition/dezog/dezog-printer";
import { t } from "@common/i18n/i18n";

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
  const count = bp.hitCount;
  switch (effectiveHitMode(bp)) {
    case "eq":
      return t("debug.hitRule.eq", { count });
    case "gt":
      return t("debug.hitRule.gt", { count });
    case "ge":
      return t("debug.hitRule.ge", { count });
    case "lt":
      return t("debug.hitRule.lt", { count });
    case "le":
      return t("debug.hitRule.le", { count });
    case "every":
      return count === 1 ? t("debug.hitRule.everyHit") : t("debug.hitRule.every", { count });
    default:
      return undefined;
  }
}

/** The tooltip lines about a breakpoint's filters and their state; empty for a plain one. */
export function breakpointFilterLines(bp: BreakpointInfo): string[] {
  const lines: string[] = [];
  if (isLogpoint(bp)) {
    if (isAnnotationBreakpoint(bp)) {
      lines.push(t("debug.bpTip.logpointComment"));
    }
    lines.push(t("debug.bpTip.logs", { message: bp.logMessage }));
    lines.push(t("debug.bpTip.group", { group: logGroupOf(bp.logMessage) }));
    if (isAnnotationBreakpoint(bp) && bp.address !== undefined) {
      lines.push(t("debug.bpTip.at", { address: `$${bp.address.toString(16).toUpperCase().padStart(4, "0")}` }));
    }
  }
  if (bp.oneShot && !bp.runTo) lines.push(t("debug.bpTip.oneShot"));
  if (bp.runTo) lines.push(t("debug.bpTip.runTo"));
  if (bp.annotationKind === "ASSERTION") {
    lines.push(t("debug.bpTip.assertionComment"));
    lines.push(
      bp.annotationText
        ? t("debug.bpTip.asserts", { expression: bp.annotationText })
        : t("debug.bpTip.assertsAlways")
    );
    if (bp.annotationText) lines.push(t("debug.bpTip.readAs", { condition: kliveConditionText(bp.annotationText) }));
  } else if (bp.annotationKind === "WPMEM") {
    lines.push(t("debug.bpTip.wpmemComment", { comment: bp.annotationText ? `WPMEM ${bp.annotationText}` : "WPMEM" }));
  }
  if (bp.condition?.trim() && !bp.annotationKind) {
    lines.push(t("debug.bpTip.condition", { condition: bp.condition.trim() }));
  }
  const rule = describeHitRule(bp);
  if (rule) lines.push(rule);
  if (bp.currentHits !== undefined && (bp.condition?.trim() || rule || isLogpoint(bp))) {
    lines.push(t("debug.bpTip.hits", { count: bp.currentHits }));
  }
  if (bp.conditionInactive) {
    lines.push(t("debug.bpTip.inactive", { label: bp.conditionInactive }));
  }
  if (bp.conditionError) {
    lines.push(t("debug.bpTip.conditionError", { error: bp.conditionError }));
  }
  if (bp.logError) {
    lines.push(t("debug.bpTip.logError", { error: bp.logError }));
  }
  return lines;
}

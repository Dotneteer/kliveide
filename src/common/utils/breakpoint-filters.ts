import type { BreakpointHitMode, BreakpointInfo, LogDialect } from "@abstractions/BreakpointInfo";

/*
 * A breakpoint's two filters — the condition and the hit-count rule — and the runtime state that
 * travels beside them, kept free of dependencies (type imports only) because the main process
 * strips that state from a project save and must not pull in renderer code.
 *
 * Every persister goes through these helpers, so "which fields are stored" has one answer. See
 * `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.1 and §4.7.
 */

/** Every hit-count rule, in the order the UI lists them. */
export const BREAKPOINT_HIT_MODES: readonly BreakpointHitMode[] = [
  "eq",
  "gt",
  "ge",
  "lt",
  "le",
  "every"
];

/** The largest N a hit-count rule accepts. The smallest is 1: `< 1` could never be true. */
export const MAX_BREAKPOINT_HIT_COUNT = 65535;

/**
 * The persisted filter fields of a breakpoint - and its action: a logpoint's template
 * (`.plans/LOGPOINTS_PLAN.md` §4.1) travels with the condition and the hit rule, because every
 * persister that must keep one must keep the other, and none of them is part of the identity.
 */
export type BreakpointFilters = Pick<
  BreakpointInfo,
  "condition" | "hitMode" | "hitCount" | "logMessage" | "logDialect"
>;

/** Is this breakpoint a logpoint - does it log instead of stopping (L1)? */
export function isLogpoint(bp: BreakpointInfo | undefined): boolean {
  return !!bp?.logMessage;
}

/** The dialect a logpoint's template is written in; absent means Klive's own. */
export function effectiveLogDialect(bp: BreakpointInfo): LogDialect {
  return bp.logDialect ?? "klive";
}

/** Is this one of the hit-count rules? */
export function isBreakpointHitMode(value: unknown): value is BreakpointHitMode {
  return typeof value === "string" && (BREAKPOINT_HIT_MODES as readonly string[]).includes(value);
}

/** Is this a usable N for a hit-count rule? */
export function isValidBreakpointHitCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_BREAKPOINT_HIT_COUNT
  );
}

/**
 * The rule a breakpoint's hit count follows, or `undefined` when it has none.
 *
 * A `hitCount` without a `hitMode` reads as `"eq"`: before the rule existed the field was an unread
 * stub, so a hand-written file is the only way to have one, and "equal" is what a bare number means.
 */
export function effectiveHitMode(bp: BreakpointInfo): BreakpointHitMode | undefined {
  if (bp.hitCount === undefined) return undefined;
  return bp.hitMode ?? "eq";
}

/** Does the breakpoint carry a condition or a hit-count rule? */
export function hasBreakpointFilters(bp: BreakpointInfo): boolean {
  return !!bp.condition?.trim() || bp.hitCount !== undefined;
}

/**
 * The breakpoint's filter fields, normalised for storage: only the ones that say something.
 *
 * An empty or blank condition is "no condition", and a `hitMode` without a `hitCount` is a rule with
 * nothing to compare against — neither is stored, so two breakpoints that behave alike are stored
 * alike.
 */
export function breakpointFiltersOf(bp: BreakpointInfo): BreakpointFilters {
  const filters: BreakpointFilters = {};
  if (bp.condition?.trim()) filters.condition = bp.condition;
  if (bp.hitCount !== undefined) {
    filters.hitCount = bp.hitCount;
    if (bp.hitMode !== undefined) filters.hitMode = bp.hitMode;
  }
  // --- An empty template is "not a logpoint"; the Klive dialect is the default and not stored
  if (bp.logMessage) {
    filters.logMessage = bp.logMessage;
    if (bp.logDialect && bp.logDialect !== "klive") filters.logDialect = bp.logDialect;
  }
  return filters;
}

/** Do two breakpoints carry the same (normalised) filters? */
export function sameBreakpointFilters(left: BreakpointInfo, right: BreakpointInfo): boolean {
  const a = breakpointFiltersOf(left);
  const b = breakpointFiltersOf(right);
  return (
    a.condition === b.condition &&
    a.hitCount === b.hitCount &&
    effectiveHitMode(a) === effectiveHitMode(b) &&
    a.logMessage === b.logMessage &&
    a.logDialect === b.logDialect
  );
}

/**
 * The breakpoint without its runtime-only fields (`currentHits`, `conditionError`,
 * `conditionInactive`, `logError`). `listBreakpoints` reports them; nothing may store them.
 *
 * A copy, never a mutation: callers hand in what `listBreakpoints` returned, which may be shared.
 */
export function withoutBreakpointRuntimeState(bp: BreakpointInfo): BreakpointInfo {
  if (
    bp.currentHits === undefined &&
    bp.conditionError === undefined &&
    bp.conditionInactive === undefined &&
    bp.logError === undefined
  ) {
    return bp;
  }
  const {
    currentHits: _hits,
    conditionError: _error,
    conditionInactive: _inactive,
    logError: _logError,
    ...stored
  } = bp;
  return stored;
}

/**
 * Read the filter fields of a stored breakpoint entry (a project file, a `.nex.dis` sidecar).
 *
 * A malformed field is dropped with a problem message rather than failing the entry: without it the
 * breakpoint stops on every hit, which is the safe direction — a breakpoint that stops too often is
 * noticed, one that never stops is not.
 *
 * @returns The valid filters, and one message per field that was dropped.
 */
export function readStoredBreakpointFilters(entry: Record<string, unknown>): {
  filters: BreakpointFilters;
  problems: string[];
} {
  const filters: BreakpointFilters = {};
  const problems: string[] = [];
  const { condition, hitMode, hitCount, logMessage, logDialect } = entry;

  if (condition !== undefined) {
    if (typeof condition !== "string") {
      problems.push("condition must be a string; ignored.");
    } else if (condition.trim()) {
      filters.condition = condition;
    }
  }

  if (hitCount !== undefined) {
    if (!isValidBreakpointHitCount(hitCount)) {
      problems.push(`hitCount must be an integer 1..${MAX_BREAKPOINT_HIT_COUNT}; ignored.`);
    } else {
      filters.hitCount = hitCount;
    }
  }

  if (hitMode !== undefined) {
    if (!isBreakpointHitMode(hitMode)) {
      problems.push(`hitMode must be one of ${BREAKPOINT_HIT_MODES.join(", ")}; ignored.`);
    } else if (filters.hitCount === undefined) {
      // --- Only a problem when it was not already reported through a bad `hitCount`
      if (hitCount === undefined) problems.push("hitMode without hitCount; ignored.");
    } else {
      filters.hitMode = hitMode;
    }
  }

  if (logMessage !== undefined) {
    if (typeof logMessage !== "string") {
      problems.push("logMessage must be a string; ignored.");
    } else if (logMessage) {
      filters.logMessage = logMessage;
    }
  }

  if (logDialect !== undefined) {
    if (logDialect !== "klive" && logDialect !== "dezog") {
      problems.push('logDialect must be "klive" or "dezog"; ignored.');
    } else if (filters.logMessage !== undefined && logDialect === "dezog") {
      filters.logDialect = logDialect;
    }
  }

  return { filters, problems };
}

/** The `-hit` spelling of each rule (§4.2); `eq` is written bare. */
const HIT_SPEC_PREFIX: Record<BreakpointHitMode, string> = {
  eq: "",
  gt: ">",
  ge: ">=",
  lt: "<",
  le: "<=",
  every: "*"
};

/**
 * The `-hit` spec of a breakpoint's rule (`10`, `>10`, `>=10`, `<10`, `<=10`, `*10`), or
 * `undefined` without one. The inverse of `parseHitSpec`.
 */
export function formatHitSpec(bp: BreakpointInfo): string | undefined {
  const mode = effectiveHitMode(bp);
  return mode ? `${HIT_SPEC_PREFIX[mode]}${bp.hitCount}` : undefined;
}

/**
 * Parse a `-hit` spec. A bare number or `=N` means "equal" (§4.2); N is decimal, `$` hex or `%`
 * binary, `1..65535`.
 */
export function parseHitSpec(
  text: string
): { hitMode: BreakpointHitMode; hitCount: number } | { error: string } {
  const match = /^\s*(>=|<=|=|>|<|\*)?\s*(\S+)\s*$/.exec(text ?? "");
  if (!match) return { error: "The hit count is empty" };
  const [, prefix = "", numberText] = match;
  const digits = numberText.replace(/_/g, "");
  let value = Number.NaN;
  if (/^\$[0-9a-f]+$/i.test(digits)) value = parseInt(digits.substring(1), 16);
  else if (/^%[01]+$/.test(digits)) value = parseInt(digits.substring(1), 2);
  else if (/^[0-9]+$/.test(digits)) value = parseInt(digits, 10);
  if (Number.isNaN(value)) {
    return { error: `Invalid hit count '${text.trim()}'; use N, =N, >N, >=N, <N, <=N or *N` };
  }
  if (!isValidBreakpointHitCount(value)) {
    return { error: `The hit count must be between 1 and ${MAX_BREAKPOINT_HIT_COUNT}` };
  }
  const hitMode = (Object.keys(HIT_SPEC_PREFIX) as BreakpointHitMode[]).find(
    (mode) => HIT_SPEC_PREFIX[mode] === (prefix === "=" ? "" : prefix)
  )!;
  return { hitMode, hitCount: value };
}

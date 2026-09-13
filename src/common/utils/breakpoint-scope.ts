import type {
  BreakpointInfo,
  BreakpointOwner,
  BreakpointScope
} from "@abstractions/BreakpointInfo";

/*
 * Breakpoint ownership, kept deliberately free of dependencies.
 *
 * The main process filters a project save with `breakpointMatchesScope`, and `common/utils/breakpoints.ts`
 * — the obvious home — imports `@renderer/...` helpers, which the main process must not pull in. So
 * these three functions live on their own, importing only types.
 */

/**
 * Does this breakpoint belong to the subset `scope` is allowed to replace?
 *
 * The two facts that make this small function load-bearing:
 *
 * - **Absent owner means the project**, so `{ kind: "project" }` must match `undefined`. A
 *   truthiness or equality test against the owner object would silently exclude every breakpoint
 *   written by an older build.
 * - **Session-owned breakpoints match only `"all"`.** Nothing persists them, so no persister may
 *   clear them either; only tearing the machine down does.
 */
export function breakpointMatchesScope(
  owner: BreakpointOwner | undefined,
  scope: BreakpointScope
): boolean {
  switch (scope.kind) {
    case "all":
      return true;
    case "project":
      return owner === undefined;
    case "nex":
      return owner?.kind === "nex" && owner.sidecar === scope.sidecar;
  }
}

/**
 * The owner a breakpoint installed under `scope` should carry.
 *
 * `"project"` yields `undefined` rather than an object, because that is project ownership's only
 * representation (see `BreakpointOwner`). `"all"` is not an ownership claim — it is used when
 * replacing everything, so each breakpoint keeps whatever owner it arrived with.
 */
export function ownerForScope(
  scope: BreakpointScope,
  current: BreakpointOwner | undefined
): BreakpointOwner | undefined {
  switch (scope.kind) {
    case "all":
      return current;
    case "project":
      return undefined;
    case "nex":
      return { kind: "nex", sidecar: scope.sidecar };
  }
}

/**
 * Stamp a breakpoint with the owner its installing scope implies.
 *
 * Returns a copy: the caller's object may be shared (a Redux value, a parsed project file), and
 * mutating it would make ownership depend on call order.
 */
export function withScopeOwner(bp: BreakpointInfo, scope: BreakpointScope): BreakpointInfo {
  const owner = ownerForScope(scope, bp.owner);
  const stamped: BreakpointInfo = { ...bp };
  if (owner === undefined) {
    delete stamped.owner;
  } else {
    stamped.owner = owner;
  }
  return stamped;
}

/** A bank-relative breakpoint is one bound to a bank and an offset rather than to an address. */
export function isBankRelative(bp: BreakpointInfo): boolean {
  return bp.address === undefined && bp.bank !== undefined && bp.bankOffset !== undefined;
}

/**
 * The 8K partition a bank-relative breakpoint must match.
 *
 * A NEX bank is 16K and a Next partition is an 8K page, so the offset decides which half of the
 * bank — and therefore which partition — the breakpoint lives in. **This is the only place the
 * 16K-to-8K conversion happens.**
 */
export function bankRelativePartition(bank: number, bankOffset: number): number {
  return bank * 2 + ((bankOffset >> 13) & 0x01);
}

/**
 * Every Z80 address at which a bank-relative breakpoint could appear.
 *
 * Its bank may be paged into any of the eight 8K slots, so the flag has to be armed at all eight
 * candidate addresses; the partition test at fire time is what picks out the one that is real. Eight
 * entries per breakpoint, against the 65,536 an I/O breakpoint already fans out to.
 */
export function bankRelativeAddresses(bankOffset: number): number[] {
  const pageOffset = bankOffset & 0x1fff;
  return Array.from({ length: 8 }, (_, slot) => slot * 0x2000 + pageOffset);
}

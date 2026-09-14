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
    default:
      /*
       * Loud, because the silent version cost real time.
       *
       * `BreakpointScope` is an object union, and a caller passing the bare string `"project"`
       * instead reached the end of this switch and got `undefined` — falsy. `resetBreakpointsTo`
       * reads this as `!matches` to decide what *survives*, so every breakpoint survived and the
       * replace quietly became an append. Nothing noticed, because a breakpoint's key normally
       * implies where it is armed: re-adding the same key overwrote the definition and the duplicate
       * arming was invisible. Label-anchored breakpoints separate identity from site (§13.2), which
       * is what finally exposed it — as an old breakpoint still firing at the address its label had
       * moved away from.
       *
       * Three test call sites were passing the string. Type-checking does not cover `test/`, so
       * nothing told them.
       */
      throw new Error(
        `Unknown breakpoint scope: ${JSON.stringify(scope)}. ` +
          'Scopes are objects — { kind: "project" }, not "project".'
      );
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
  return effectiveBankSite(bp) !== undefined;
}

/**
 * The bank and offset a breakpoint actually occupies, however it came by them.
 *
 * The bank-relative twin of `address ?? resolvedAddress`, and the single place that fallback is
 * expressed: a breakpoint may state its site directly (`bp-set 05:+$0100`) or have it filled in by
 * resolution (a label-anchored breakpoint, once its sidecar's label table has been read). Everything
 * downstream — the arming, the partition test, the key, the one-shot consumption — must treat the
 * two identically, and the way to guarantee that is for none of them to know there are two.
 *
 * A stated `address` wins, as it always has: a breakpoint is never both an address and a bank site.
 */
export function effectiveBankSite(
  bp: BreakpointInfo
): { bank: number; bankOffset: number } | undefined {
  if (bp.address !== undefined) return undefined;

  const bank = bp.bank ?? bp.resolvedBank;
  const bankOffset = bp.bankOffset ?? bp.resolvedBankOffset;
  if (bank === undefined || bankOffset === undefined) return undefined;
  return { bank, bankOffset };
}

/**
 * Is this breakpoint anchored to a label?
 *
 * True whether or not it has been resolved yet. An unresolved one is armed nowhere — like a source
 * breakpoint before its list file is read — but it still exists, is listed, and is persisted.
 */
export function isLabelAnchored(bp: BreakpointInfo): boolean {
  return !!bp.label && !!bp.labelFile;
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

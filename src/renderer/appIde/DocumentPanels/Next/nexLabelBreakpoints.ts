import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { NexFileAnnotations } from "./nexAnnotations";

import { getBankAnnotation } from "./nexAnnotations";

/*
 * Breakpoints anchored to a NEX annotation's labels.
 *
 * The third binding mode, and the only one that survives code moving. An address breakpoint names a
 * place in memory; a bank-relative one names an offset in a bank. Both stop meaning what the user
 * meant as soon as a rebuild shifts the routine by three bytes. "Break at `DrawSprite`" keeps
 * meaning it, resolved through the sidecar's label table the way a source breakpoint is resolved
 * through the compiler's list file.
 *
 * Pure: the resolution is a function of a breakpoint and a sidecar's annotations, so it is decided
 * here and tested without a machine, a document or a file. See `.plans/NEX_DEBUGGING_PLAN.md` §13.2.
 */

/** Where a label-anchored breakpoint turned out to be. */
export type LabelResolution =
  /** A bank's **local** label: its value is bank-relative, so the breakpoint follows the bank. */
  | { kind: "bank"; bank: number; bankOffset: number }
  /** A **global** label: its value is a 16-bit address, so the breakpoint sits at that address. */
  | { kind: "address"; address: number }
  /**
   * The label is not in the table.
   *
   * Not an error, and not a reason to delete the breakpoint: a label can be renamed, or the sidecar
   * can simply not have loaded yet. An unresolved label-anchored breakpoint is armed nowhere and
   * waits, exactly as a source breakpoint does before its list file is read.
   */
  | { kind: "unresolved" };

/**
 * Resolve one label-anchored breakpoint against a sidecar's labels.
 *
 * The scope is decided by the breakpoint, not searched for: `bank` present means a local label in
 * that bank, absent means a global one. Searching both and preferring one would make
 * `05:DrawSprite` and `DrawSprite` the same breakpoint whenever only one of the two labels existed,
 * and then silently different once the other was added.
 */
export function resolveLabelBreakpoint(
  bp: BreakpointInfo,
  annotations: NexFileAnnotations | undefined
): LabelResolution {
  if (!bp.label || !annotations) return { kind: "unresolved" };

  if (bp.bank === undefined) {
    const global = annotations.globalLabels?.find((label) => label.name === bp.label);
    return global ? { kind: "address", address: global.value & 0xffff } : { kind: "unresolved" };
  }

  const local = getBankAnnotation(annotations, bp.bank)?.localLabels?.find(
    (label) => label.name === bp.label
  );
  return local
    ? { kind: "bank", bank: bp.bank, bankOffset: local.value & 0x3fff }
    : { kind: "unresolved" };
}

/**
 * What `resolveBreakpoints` should be told about this breakpoint, or `undefined` when it resolved
 * to nothing.
 *
 * Shaped as a patch of the `resolved*` fields rather than as a new breakpoint: the stated fields
 * are its identity and resolution must never touch them (see `buildBreakpointKey`).
 */
export type LabelResolutionPatch = {
  resolvedAddress?: number;
  resolvedBank?: number;
  resolvedBankOffset?: number;
};

/** The patch a resolution implies. */
export function patchForResolution(
  resolution: LabelResolution
): LabelResolutionPatch | undefined {
  switch (resolution.kind) {
    case "address":
      return { resolvedAddress: resolution.address };
    case "bank":
      return { resolvedBank: resolution.bank, resolvedBankOffset: resolution.bankOffset };
    default:
      return undefined;
  }
}

/**
 * Resolve every label-anchored breakpoint belonging to one sidecar.
 *
 * Only that sidecar's: `labelFile` is part of a breakpoint's identity, and another file's labels are
 * a different table that happens to share names. Breakpoints of every other shape are left exactly
 * as they are — this is a read-modify-write of the whole set, so anything it fails to copy through
 * would be deleted.
 */
export function resolveLabelBreakpointsFor(
  breakpoints: BreakpointInfo[],
  labelFile: string,
  annotations: NexFileAnnotations | undefined
): BreakpointInfo[] {
  return breakpoints.map((bp) => {
    if (!bp.label || bp.labelFile !== labelFile) return bp;

    const patch = patchForResolution(resolveLabelBreakpoint(bp, annotations));
    /*
     * The previous resolution is cleared whether or not a new one replaces it.
     *
     * A label that has been renamed away must stop firing where it used to be; keeping the stale
     * `resolved*` fields would leave a breakpoint armed at an address nothing points at any more,
     * which is the same phantom `resetBreakpointResolution` exists to prevent for source
     * breakpoints.
     */
    const cleared: BreakpointInfo = { ...bp };
    delete cleared.resolvedAddress;
    delete cleared.resolvedBank;
    delete cleared.resolvedBankOffset;
    return patch ? { ...cleared, ...patch } : cleared;
  });
}

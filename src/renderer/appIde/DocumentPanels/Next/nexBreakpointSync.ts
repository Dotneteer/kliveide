import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import type { NexSidecarBreakpoint, NexSidecarBreakpointKind } from "./nexAnnotations";

/*
 * Translating between a NEX sidecar's breakpoints and the emulator's.
 *
 * The two speak about the same thing in different vocabularies: the sidecar records `kind` as one
 * word, while `BreakpointInfo` spreads it across mutually exclusive boolean flags. Keeping the
 * conversion here — and pure — is what lets the round trip be tested without an emulator.
 *
 * The emulator is the runtime authority and the sidecar is the only persistence for these
 * breakpoints; see `.plans/NEX_DEBUGGING_PLAN.md` §9.4a.
 */

/** The sidecar's one-word kind, from a breakpoint's flags. */
export function sidecarKindOf(bp: BreakpointInfo): NexSidecarBreakpointKind | undefined {
  if (bp.memoryRead) return "memRead";
  if (bp.memoryWrite) return "memWrite";
  // --- `exec` is the default, but only for a breakpoint that is not an I/O one — a port has no bank
  // --- and cannot be stored here at all.
  if (bp.ioRead || bp.ioWrite) return undefined;
  return "exec";
}

/**
 * The breakpoints of one sidecar, as it should store them.
 *
 * Only the bank-relative ones owned by that sidecar: an address breakpoint that happens to fall
 * inside a bank's current window is not a breakpoint *on the bank*, and one owned by another
 * sidecar belongs in that file.
 *
 * Sorted by bank then offset, so the file does not churn when two breakpoints are set in a
 * different order than last time.
 */
export function toSidecarBreakpoints(
  breakpoints: BreakpointInfo[],
  sidecar: string
): NexSidecarBreakpoint[] {
  const stored: NexSidecarBreakpoint[] = [];
  for (const bp of breakpoints) {
    if (bp.owner?.kind !== "nex" || bp.owner.sidecar !== sidecar) continue;
    /*
     * Stated fields only, and a label-anchored breakpoint is skipped outright.
     *
     * A resolved label breakpoint *has* an effective bank site, so anything asking
     * `isBankRelative` would say yes and store it as a bare bank and offset — losing the label
     * that is its identity and silently turning it into a different kind of breakpoint on the next
     * load. Storing label breakpoints properly needs its own sidecar field; until then they are
     * session-lived, which is honest, whereas a lossy save is not.
     */
    if (bp.label) continue;
    if (bp.bank === undefined || bp.bankOffset === undefined) continue;
    const kind = sidecarKindOf(bp);
    if (!kind) continue;
    const entry: NexSidecarBreakpoint = { bank: bp.bank, offset: bp.bankOffset, kind };
    if (bp.disabled) entry.disabled = true;
    stored.push(entry);
  }
  return stored.sort((left, right) => left.bank - right.bank || left.offset - right.offset);
}

/** The emulator breakpoints a sidecar's stored entries describe, owned by that sidecar. */
export function fromSidecarBreakpoints(
  stored: NexSidecarBreakpoint[] | undefined,
  sidecar: string
): BreakpointInfo[] {
  return (stored ?? []).map((entry) => {
    const bp: BreakpointInfo = {
      bank: entry.bank,
      bankOffset: entry.offset,
      owner: { kind: "nex", sidecar }
    };
    if (entry.kind === "memRead") {
      bp.memoryRead = true;
    } else if (entry.kind === "memWrite") {
      bp.memoryWrite = true;
    } else {
      bp.exec = true;
    }
    if (entry.disabled) bp.disabled = true;
    return bp;
  });
}

/**
 * Do two stored sets describe the same breakpoints?
 *
 * Used to decide whether a write is needed at all. Both sides come from `toSidecarBreakpoints`, so
 * they are already sorted and a field-by-field walk is enough — no need to canonicalise again.
 */
export function sameSidecarBreakpoints(
  left: NexSidecarBreakpoint[] | undefined,
  right: NexSidecarBreakpoint[] | undefined
): boolean {
  const a = left ?? [];
  const b = right ?? [];
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return (
      entry.bank === other.bank &&
      entry.offset === other.offset &&
      entry.kind === other.kind &&
      !!entry.disabled === !!other.disabled
    );
  });
}

import { bankSpaceFor } from "@common/annotations/bankSpace";

/*
 * Which memory partition a line of banked source code lives in.
 *
 * The assembler knows: `.bank N [, offset]` assembles at `$C000 + offset` and records `bank` and
 * `bankOffset` on the segment. That was known and discarded — `refreshSourceCodeBreakpoints` took
 * only `lineInfo.address` — so a source breakpoint in one `.bank` section fired inside *another*
 * one, because both are at the same Z80 addresses. On the ZX Spectrum Next that is not an edge
 * case: `.bank` sections routinely share addresses, which is the entire point of them.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §13.4.
 */

/** The parts of a compiled segment this needs. Deliberately not `BinarySegment` itself. */
export type BankedSegmentInfo = {
  /** The 16K bank the segment was assembled into, or absent for unbanked code. */
  bank?: number;
  /** The offset within that bank the segment starts at. */
  bankOffset?: number;
  /** The Z80 address the segment starts at — `$C000 + bankOffset` for `.bank`, any address for `.page`. */
  startAddress: number;
};

/**
 * The partition a line belongs to, or `undefined` when it belongs to no particular one.
 *
 * **Machine-dependent, and that is the whole difficulty.** `.bank` always names a 16K bank, but a
 * *partition* does not always mean the same thing:
 *
 * - on the **ZX Spectrum Next** a partition is an 8K page (Q9, §4.1), so a 16K bank is two of them
 *   and which one a line is in depends on its offset — exactly the conversion
 *   `bankRelativePartition` performs for a bank-relative breakpoint;
 * - on the **128K and +3** a partition *is* the 16K bank, so the bank number passes straight
 *   through;
 * - on the **48K** there are no partitions, so a `.bank 5` line is partitionless.
 *
 * `bankSpaceFor(machineId).partitionOf` makes the choice (`@common/annotations/bankSpace`).
 *
 * Getting this wrong is silent: the breakpoint simply never fires, because the partition test at
 * fire time compares against a number that is never paged anywhere.
 *
 * `undefined` for unbanked code, which must stay partitionless — an unbanked breakpoint fires
 * whatever is paged in, and that is the behaviour every non-Next project depends on.
 */
export function resolvedPartitionFor(
  segment: BankedSegmentInfo | undefined,
  address: number,
  machineId: string | undefined
): number | undefined {
  if (!segment || segment.bank === undefined) return undefined;

  // --- The bank space knows: an 8K page on the Next, the bank itself on the 128K family, nothing
  // --- on the 48K (whose banks are at fixed addresses, so the line's address alone decides).
  const space = bankSpaceFor(machineId);
  if (!space) return segment.bank;
  return space.partitionOf({ bank: segment.bank, offset: bankOffsetOfLine(segment, address) });
}

/**
 * How far into its 16K bank a line sits.
 *
 * Derived from the segment's own start rather than assumed to be `address & 0x3FFF`: the two agree
 * for `.bank`'s `$C000 + offset` convention, but the segment states where it begins and there is no
 * reason for this to re-derive it and be wrong if that ever changes.
 *
 * Clamped into the bank, so a line reported outside the segment — which a macro or a `.xorg` can
 * produce — cannot name an offset in a neighbouring bank.
 */
export function bankOffsetOfLine(segment: BankedSegmentInfo, address: number): number {
  const offset = (segment.bankOffset ?? 0) + (address - segment.startAddress);
  return Math.max(0, Math.min(0x3fff, offset));
}

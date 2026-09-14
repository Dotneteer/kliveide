import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

/**
 * Which breakpoint, if any, a disassembly row should show in its gutter.
 *
 * This exists because the gutter used to be keyed by address alone:
 *
 * ```ts
 * if (breakpoint.address !== undefined) map.set(breakpoint.address, breakpoint);
 * ```
 *
 * A `Map<number, BreakpointInfo>` cannot hold two breakpoints at one address, so on a machine with
 * banks the last one parsed silently won — and a breakpoint scoped to bank `B3` lit up the gutter
 * while you were looking at bank `B5`. The panel always knew its partition (`currentSegment`, or the
 * live paging in the 64K view); it simply never used it to match.
 *
 * The rule implemented here is deliberately conservative, because it is a bug fix rather than a
 * redesign:
 *
 * - a **partition-scoped** breakpoint shows only where its partition actually applies;
 * - a **partitionless** breakpoint keeps its old behaviour and shows at its address in any view.
 *
 * A partition-scoped match wins over a partitionless one at the same address, being the more
 * specific of the two. Any deterministic choice is an improvement on "whichever came last".
 *
 * `selectRowBreakpoint` later gained two more tie-breakers — kind, then enablement — for the same
 * reason: watchpoints made ties common, and the glyph is what the gutter's remove command is built
 * from. See the function's own comment.
 */

/** Every address-bound breakpoint at an address. Several can share one address. */
export type BreakpointsByAddress = Map<number, BreakpointInfo[]>;

/**
 * The partition a breakpoint is scoped to, or `undefined` when it applies to every partition.
 *
 * `resolvedPartition` is included for the source-bound case. Nothing writes it today, so this is
 * the shape the code takes rather than a path it exercises.
 */
export function breakpointPartition(bp: BreakpointInfo): number | undefined {
  return bp.partition ?? bp.resolvedPartition;
}

/**
 * Group address-bound breakpoints by the address they occupy.
 *
 * A source-bound breakpoint is indexed under its `resolvedAddress`, and an address-bound one under
 * `address`; a breakpoint carrying both is indexed under both, as before.
 */
export function buildBreakpointMap(breakpoints: BreakpointInfo[]): BreakpointsByAddress {
  const map: BreakpointsByAddress = new Map();
  const add = (address: number, bp: BreakpointInfo) => {
    const at = map.get(address);
    if (at) {
      at.push(bp);
    } else {
      map.set(address, [bp]);
    }
  };
  breakpoints.forEach((breakpoint) => {
    if (breakpoint.address !== undefined) {
      add(breakpoint.address, breakpoint);
    }
    if (breakpoint.resolvedAddress !== undefined) {
      add(breakpoint.resolvedAddress, breakpoint);
    }
  });
  return map;
}

/**
 * Invert a machine's `getPartitionLabels()` map.
 *
 * The live paging reaches the renderer as *labels* (`getMemoryContents` returns
 * `partitionLabels`, never indices), while a breakpoint names its partition by *index*. The
 * partition-naming plan settled that the short label is the partition's identity, so going through
 * it is the sanctioned route rather than a workaround — but it has to be inverted once, not once
 * per row: the ZX Next has 247 of them.
 */
export function buildPartitionIndexByLabel(
  partitionLabels: Record<number, string> | undefined
): Map<string, number> {
  const byLabel = new Map<string, number>();
  if (!partitionLabels) return byLabel;
  for (const [index, label] of Object.entries(partitionLabels)) {
    // --- First wins: a duplicated label would be a defect in the machine's map, and silently
    // --- picking the higher index would hide it.
    if (!byLabel.has(label)) {
      byLabel.set(label, Number(index));
    }
  }
  return byLabel;
}

/**
 * The numeric partition paged into each 8K page of the visible 64K, from the labels the emulator
 * reported. `undefined` where the page is unpaged — `UNPAGED_PARTITION_LABEL` is deliberately not in
 * the label map, so it inverts to nothing, which is the right answer.
 */
export function resolveMem64kPartitions(
  mem64kLabels: string[] | undefined,
  partitionIndexByLabel: Map<string, number>
): (number | undefined)[] {
  return (mem64kLabels ?? []).map((label) => partitionIndexByLabel.get(label));
}

/**
 * The partition a row's address belongs to, in whichever view is showing.
 *
 * In a bank view that is the selected partition. In the 64K view it is whatever is paged in at that
 * address right now — the same question `getPartition(address)` answers in the emulator, which is
 * what makes the gutter agree with where the machine will actually stop.
 */
export function resolveRowPartition(
  address: number,
  isFullView: boolean,
  currentSegment: number | undefined,
  mem64kPartitions: (number | undefined)[]
): number | undefined {
  if (!isFullView) return currentSegment;
  return mem64kPartitions[(address >> 13) & 0x07];
}

/**
 * Pick the breakpoint to show for one row.
 *
 * Three things decide it, in order, and each exists because leaving it out produced a wrong glyph:
 *
 * 1. **Partition specificity.** A partition-scoped breakpoint beats a partitionless one, being the
 *    more specific of the two, and a breakpoint scoped to a *different* partition is not a
 *    candidate at all — that was the original defect this module was written for.
 * 2. **Kind.** An execution breakpoint beats a memory one. The gutter's click gesture creates
 *    execution breakpoints, so that is the kind the column reads as being about; and the glyph is
 *    what `BreakpointIndicator` builds its `bp-del` command from, so showing a watchpoint where an
 *    execution breakpoint also sits would build a command for the wrong one.
 * 3. **Enabled before disabled**, so a row never looks disarmed while something there is live.
 *
 * Anything not chosen is still in the Breakpoints panel; this decides one glyph, not what exists.
 *
 * @param candidates every breakpoint at this row's address, from `buildBreakpointMap`
 * @param rowPartition the partition this row belongs to, from `resolveRowPartition`
 */
export function selectRowBreakpoint(
  candidates: BreakpointInfo[] | undefined,
  rowPartition: number | undefined
): BreakpointInfo | undefined {
  if (!candidates?.length) return undefined;

  let best: BreakpointInfo | undefined;
  let bestRank = -1;
  for (const bp of candidates) {
    const partition = breakpointPartition(bp);
    if (partition !== undefined && partition !== rowPartition) continue;

    // --- Specificity dominates kind, which dominates enablement.
    const rank =
      (partition === undefined ? 0 : 4) + (isExecBreakpoint(bp) ? 2 : 0) + (bp.disabled ? 0 : 1);
    if (rank > bestRank) {
      best = bp;
      bestRank = rank;
    }
  }
  return best;
}

/**
 * Is this an execution breakpoint?
 *
 * `exec` is what `bp-set` sets when no `-r`/`-w`/`-i`/`-o` option is given, so an execution
 * breakpoint is equally "one that is none of the others" — which is what a breakpoint restored from
 * an older project file, carrying no flags at all, looks like.
 */
function isExecBreakpoint(bp: BreakpointInfo): boolean {
  return !!bp.exec || !(bp.memoryRead || bp.memoryWrite || bp.ioRead || bp.ioWrite);
}

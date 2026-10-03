import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import type { LogpointGroupState, SourceCommentSwitches } from "@abstractions/BreakpointInfo";
import {
  isAnnotationBreakpoint,
  isBankRelative,
  isLabelAnchored,
  isNextRegBreakpoint
} from "@common/utils/breakpoint-scope";
import { isLogpoint } from "@common/utils/breakpoint-filters";
import { logGroupOf } from "@common/utils/breakpoint-condition/logpoint-template";

/**
 * How the Breakpoints panel orders and groups its rows, with no React in it.
 *
 * Two problems, one function. The panel had no order at all - rows came out in
 * `DebugSupport.breakpointDefs` insertion order, so the list reshuffled every time a breakpoint was
 * added or removed - and with a sixth kind arriving, a flat unordered list of mixed shapes is worse
 * still. Grouping fixes both, and the sort runs whether or not the headers do (§4.9a): the toolbar
 * toggle controls headers, not order, because reverting to insertion order would hand back the
 * reshuffling along with the flat list.
 *
 * See `.plans/NEXTREG_WRITE_BREAKPOINTS_PLAN.md` §4.9a.
 */

/** The six groups, which are the six breakpoint kinds. */
export type BreakpointGroup =
  | "exec"
  | "memRead"
  | "memWrite"
  | "ioRead"
  | "ioWrite"
  | "nextRegWrite";

/** Group order, matching the dialog's type selector so the two read the same way. */
export const BREAKPOINT_GROUP_ORDER: readonly BreakpointGroup[] = [
  "exec",
  "memRead",
  "memWrite",
  "ioRead",
  "ioWrite",
  "nextRegWrite"
];

/** What a group header calls itself. Sentence case, as the dialog's options are. */
export const BREAKPOINT_GROUP_TITLES: Record<BreakpointGroup, string> = {
  exec: "Execution",
  memRead: "Memory read",
  memWrite: "Memory write",
  ioRead: "I/O read",
  ioWrite: "I/O write",
  nextRegWrite: "NextReg write"
};

/**
 * The type glyph for each group, the same one the row's own indicator shows.
 *
 * Repeated in the header deliberately: it is what makes the icon set learnable, and a virtualized
 * list scrolls rows away from the header that named them.
 */
export const BREAKPOINT_GROUP_ICONS: Record<BreakpointGroup, string> = {
  exec: "bp-exec",
  memRead: "bp-mem-read",
  memWrite: "bp-mem-write",
  ioRead: "bp-io-read",
  ioWrite: "bp-io-write",
  nextRegWrite: "bp-nextreg"
};

/** A header, or a breakpoint. One flat array, because `VirtualizedList` takes one. */
export type BreakpointListItem<T extends BreakpointInfo = BreakpointInfo> =
  | { kind: "header"; group: BreakpointGroup; count: number }
  | { kind: "row"; bp: T }
  // --- The logpoint sections (`.plans/LOGPOINTS_PLAN.md` §4.5)
  | {
      kind: "sectionHeader";
      section: "logGroups" | "comments" | "assertions" | "wpmem";
      count: number;
      /**
       * The section's switch (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` S6): present on the
       * ASSERTION and WPMEM comment sections, whose header row carries the checkbox.
       */
      on?: boolean;
    }
  | { kind: "logGroup"; group: string; on: boolean; count: number };

/**
 * Which group a breakpoint belongs to.
 *
 * The register is tested first, as it is in `buildBreakpointKey` and `breakpointToForm`: it is the
 * binding, so it decides before any kind flag is read.
 */
export function groupOf(bp: BreakpointInfo): BreakpointGroup {
  if (isNextRegBreakpoint(bp)) return "nextRegWrite";
  if (bp.memoryRead) return "memRead";
  if (bp.memoryWrite) return "memWrite";
  if (bp.ioRead) return "ioRead";
  if (bp.ioWrite) return "ioWrite";
  return "exec";
}

/**
 * How a breakpoint's *shape* orders within its group: address, then bank-relative, then
 * label-anchored, then source-bound.
 *
 * Shape before key, so source breakpoints cluster at the foot of the Execution group instead of
 * interleaving among `$`-addresses. They are a different thing to look at - they alone carry a
 * resolved-address cell - and a user scanning for one is not scanning for the others.
 */
export function shapeRank(bp: BreakpointInfo): number {
  if (bp.address !== undefined) return 0;
  if (isNextRegBreakpoint(bp)) return 0;
  if (isBankRelative(bp)) return 1;
  if (isLabelAnchored(bp)) return 2;
  return 3;
}

/**
 * The display key, or `undefined` for a breakpoint that has none.
 *
 * `getBreakpointDisplayKey` throws when a breakpoint carries no key information. Such a row should
 * not be dropped - a breakpoint the user cannot see is one they cannot delete - so it keeps its
 * place and sorts last.
 */
function safeKey(bp: BreakpointInfo, partitionLabels: Record<number, string>): string | undefined {
  try {
    return getBreakpointDisplayKey(bp, partitionLabels);
  } catch {
    return undefined;
  }
}

/**
 * Orders breakpoints within a group by shape, then by display key.
 *
 * **A plain string compare on the key is correct here, and that is a fact about the key format
 * rather than laziness.** Every key renders its numbers as fixed-width hexadecimal - `$8000`,
 * `05:+$0100`, `NR:$07` - so lexicographic order *is* numeric order. It would be wrong the moment a
 * key rendered an address as variable-width decimal.
 *
 * The obvious-looking alternative, a numeric compare on `bp.address`, cannot work at all: three of
 * the four shapes have no address, and nothing would order them against each other.
 */
function compareWithin(
  a: BreakpointInfo,
  b: BreakpointInfo,
  partitionLabels: Record<number, string>
): number {
  const rank = shapeRank(a) - shapeRank(b);
  if (rank !== 0) return rank;

  const keyA = safeKey(a, partitionLabels);
  const keyB = safeKey(b, partitionLabels);
  if (keyA === undefined) return keyB === undefined ? 0 : 1;
  if (keyB === undefined) return -1;
  return keyA.localeCompare(keyB);
}

/**
 * Lays breakpoints out for the panel: sorted always, with group headers when asked.
 *
 * @param bps The breakpoints as the emulator listed them
 * @param partitionLabels The machine's labels, for building the keys the sort compares
 * @param grouped Whether to emit headers. Order does not depend on this.
 */
export function groupBreakpoints<T extends BreakpointInfo>(
  bps: readonly T[],
  partitionLabels: Record<number, string>,
  grouped: boolean
): BreakpointListItem<T>[] {
  /*
   * One order, whether or not the headers are drawn.
   *
   * `grouped` hides the headers; it does not reshuffle the rows. Sorting differently in the two
   * modes would make the toggle move every row as well as remove six of them, which is a lot of
   * motion for a control whose whole purpose is to reclaim those six rows.
   */
  // --- `LOGPOINT` comments are the build's and have a section of their own (`logpointSections`)
  const sorted = bps.filter((bp) => !isAnnotationBreakpoint(bp)).sort((a, b) => {
    const groupDelta =
      BREAKPOINT_GROUP_ORDER.indexOf(groupOf(a)) - BREAKPOINT_GROUP_ORDER.indexOf(groupOf(b));
    if (groupDelta !== 0) return groupDelta;
    return compareWithin(a, b, partitionLabels);
  });

  if (!grouped) {
    return sorted.map((bp) => ({ kind: "row", bp }));
  }

  const items: BreakpointListItem<T>[] = [];
  for (const group of BREAKPOINT_GROUP_ORDER) {
    const rows = sorted.filter((bp) => groupOf(bp) === group);
    // --- An empty group renders nothing at all, header included: a machine with three execution
    // --- breakpoints should look as it always has, plus one header.
    if (!rows.length) continue;
    items.push({ kind: "header", group, count: rows.length });
    for (const bp of rows) items.push({ kind: "row", bp });
  }
  return items;
}

/** Does the group switch let this group log? */
export function isLogGroupOn(state: LogpointGroupState | undefined, group: string): boolean {
  if (!state) return true;
  return state.enabled && (!state.groups || state.groups.includes(group.toUpperCase()));
}

/**
 * The panel's logpoint sections, after the breakpoints (`.plans/LOGPOINTS_PLAN.md` §4.5): one switch
 * row per log group any logpoint names, then the logpoints read from `LOGPOINT` comments, ordered
 * by source location. Shown whether or not the kind headers are, because the comment rows are
 * read-only and must not mix with the user's own.
 */
export function logpointSections<T extends BreakpointInfo>(
  bps: readonly T[],
  state: LogpointGroupState | undefined,
  switches: SourceCommentSwitches = {}
): BreakpointListItem<T>[] {
  const items: BreakpointListItem<T>[] = [];
  const groups = new Map<string, number>();
  for (const bp of bps) {
    if (!isLogpoint(bp)) continue;
    const group = logGroupOf(bp.logMessage);
    groups.set(group, (groups.get(group) ?? 0) + 1);
  }
  if (groups.size) {
    items.push({ kind: "sectionHeader", section: "logGroups", count: groups.size });
    for (const [group, count] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      items.push({ kind: "logGroup", group, on: isLogGroupOn(state, group), count });
    }
  }
  const bySource = (a: T, b: T) =>
    (a.resource ?? "").localeCompare(b.resource ?? "") ||
    (a.line ?? 0) - (b.line ?? 0) ||
    (a.address ?? 0) - (b.address ?? 0) ||
    Number(!!a.memoryWrite) - Number(!!b.memoryWrite);
  const comments = bps
    .filter((bp) => isAnnotationBreakpoint(bp) && !bp.annotationKind)
    .sort(bySource);
  if (comments.length) {
    items.push({ kind: "sectionHeader", section: "comments", count: comments.length });
    for (const bp of comments) items.push({ kind: "row", bp });
  }
  /*
   * The ASSERTION and WPMEM comment sections (S6, §4.8): a header with the project's switch, shown
   * while the build has such comments *or* the switch is off - a switched-off kind installs
   * nothing, and its header is the way back on.
   */
  const commentSection = (
    section: "assertions" | "wpmem",
    kind: "ASSERTION" | "WPMEM",
    on: boolean
  ) => {
    const rows = bps.filter((bp) => bp.annotationKind === kind).sort(bySource);
    if (!rows.length && on) return;
    items.push({ kind: "sectionHeader", section, count: rows.length, on });
    for (const bp of rows) items.push({ kind: "row", bp });
  };
  commentSection("assertions", "ASSERTION", switches.assertion !== false);
  commentSection("wpmem", "WPMEM", switches.wpmem !== false);
  return items;
}

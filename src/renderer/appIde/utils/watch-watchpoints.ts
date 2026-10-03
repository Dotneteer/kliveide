import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { WatchInfo } from "@common/state/AppState";

/*
 * The two-way link between a *watch* (a value display) and a *watchpoint* (a memory breakpoint),
 * `.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §3.3 and §4.7. No React, so the size-by-type
 * mapping, the overlap test and the reverse direction are tested on their own.
 */

/** The access a Watch row's menu item breaks on (W2). */
export type WatchAccess = "w" | "r" | "rw";

/**
 * How many bytes a watch shows (W2): `b`/`f` 1, `w`/`-w` 2, `l`/`-l` 4, `a`/`s` its `length`.
 * `undefined` for a direct (`>`) watch, which shows the symbol's value and has no memory.
 */
export function watchByteCount(watch: WatchInfo): number | undefined {
  if (watch.direct) return undefined;
  switch (watch.type) {
    case "b":
    case "f":
      return 1;
    case "w":
    case "-w":
      return 2;
    case "l":
    case "-l":
      return 4;
    case "a":
    case "s":
      return watch.length && watch.length > 0 ? watch.length : undefined;
    default:
      return undefined;
  }
}

/**
 * The watchpoints a Watch row's "Break on ..." item creates: project-owned memory breakpoints over
 * the watch's bytes, **anchored to its symbol** (W3) - the emulator resolves the symbol after every
 * build, so a rebuild that moves the label moves the watched bytes. One per access kind.
 */
export function watchpointsForWatch(watch: WatchInfo, access: WatchAccess): BreakpointInfo[] {
  const length = watchByteCount(watch);
  if (length === undefined) return [];
  const place: BreakpointInfo = {
    watchSymbol: watch.symbol,
    ...(length > 1 ? { length } : {})
  };
  const result: BreakpointInfo[] = [];
  if (access !== "w") result.push({ ...place, memoryRead: true });
  if (access !== "r") result.push({ ...place, memoryWrite: true });
  return result;
}

/** The bytes a memory breakpoint watches now, or `undefined` while it has no address. */
export function watchpointRange(bp: BreakpointInfo): { start: number; length: number } | undefined {
  if (!bp.memoryRead && !bp.memoryWrite) return undefined;
  const start = bp.address ?? bp.resolvedAddress;
  if (start === undefined) return undefined;
  return { start, length: bp.length && bp.length > 1 ? bp.length : 1 };
}

/**
 * Every enabled memory breakpoint overlapping `[start, start + length)` (W4) - user-made,
 * watch-made or from a `WPMEM` comment alike.
 */
export function overlappingWatchpoints(
  start: number,
  length: number,
  bps: readonly BreakpointInfo[]
): BreakpointInfo[] {
  return bps.filter((bp) => {
    if (bp.disabled) return false;
    const range = watchpointRange(bp);
    if (!range) return false;
    return range.start < start + length && start < range.start + range.length;
  });
}

/** The watchpoints made from this watch's own symbol (what "Remove watchpoint" removes). */
export function watchpointsOfWatch(watch: WatchInfo, bps: readonly BreakpointInfo[]): BreakpointInfo[] {
  const symbol = watch.symbol.toLowerCase();
  return bps.filter((bp) => bp.watchSymbol?.toLowerCase() === symbol);
}

/**
 * The `w-add` spec that shows a memory breakpoint's bytes (W5): `b`, `w`, `l` by size, otherwise
 * a byte array of the range's length.
 */
export function watchSpecForRange(symbol: string, length: number): string {
  switch (length) {
    case 1:
      return `${symbol}:b`;
    case 2:
      return `${symbol}:w`;
    case 4:
      return `${symbol}:l`;
    default:
      return `${symbol}:a:${length}`;
  }
}

/**
 * The build symbol that starts exactly at a memory breakpoint's address, for "Add to Watch" (W5,
 * Q4: no watch by address only). `symbols` maps names to values; the first name in order wins.
 */
export function symbolAtAddress(
  address: number,
  symbols: Record<string, number>
): string | undefined {
  for (const [name, value] of Object.entries(symbols)) {
    if (!name.includes(":") && (value & 0xffff) === address) return name;
  }
  return undefined;
}

/** Does any watch already show the bytes at `start`? */
export function watchCoversAddress(
  start: number,
  watches: readonly WatchInfo[],
  symbols: Record<string, number>
): boolean {
  return watches.some((watch) => {
    const value = symbols[watch.symbol.toLowerCase()];
    const length = watchByteCount(watch);
    if (value === undefined || length === undefined) return false;
    const at = value & 0xffff;
    return start >= at && start < at + length;
  });
}

/** The tooltip lines naming the watchpoints over a watch's bytes (W4). */
export function describeWatchpoints(bps: readonly BreakpointInfo[]): string[] {
  const hex = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
  return bps.map((bp) => {
    const range = watchpointRange(bp)!;
    const at =
      range.length > 1 ? `${hex(range.start)}-${hex(range.start + range.length - 1)}` : hex(range.start);
    const source = bp.annotationKind
      ? `WPMEM comment, ${bp.resource}:${bp.line}`
      : bp.watchSymbol
        ? `from the watch on ${bp.watchSymbol}`
        : "breakpoint";
    return `Break on ${bp.memoryRead ? "read" : "write"} at ${at} (${source})`;
  });
}

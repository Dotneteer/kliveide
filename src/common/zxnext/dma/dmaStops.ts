/**
 * DMA stops (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §12): breakpoints bound to a ZX Spectrum Next DMA
 * event instead of an address, written `dma:<kind>[:<argument>]`:
 *
 * | Spec | Stops |
 * |---|---|
 * | `dma:enable` | at the end of the instruction that enabled the DMA |
 * | `dma:load` | at the end of the instruction that wrote `$CF` |
 * | `dma:end` | after the byte that ends a block, before the next instruction |
 * | `dma:count:<n>` | after the byte that brings the block's bytes moved to n |
 * | `dma:write:<addr>[-<addr>]` | after the DMA writes memory in the range |
 * | `dma:held:<T>` | when one hold of the bus passes T CPU T-states |
 * | `dma:problem` | at the end of the instruction whose write was a setup problem |
 *
 * The normalized spec (lower case, `$` hex, no `dma:`) is stored in `BreakpointInfo.dmaStop` and is the
 * breakpoint's identity. The core's record and kind numbers are `zxnext-dma.c`'s (`ZXNEXT_DMAW_*`).
 */

export type DmaStopKind = "enable" | "load" | "end" | "count" | "write" | "held" | "problem";

export type DmaStop = {
  kind: DmaStopKind;
  /** count: the bytes moved */
  count?: number;
  /** write: the inclusive range */
  from?: number;
  to?: number;
  /** held: the limit in CPU T-states */
  limit?: number;
};

export type DmaStopParseError = "kind" | "count" | "address" | "limit" | "extra";

const KINDS: DmaStopKind[] = ["enable", "load", "end", "count", "write", "held", "problem"];

/** The core's kind numbers (`ZXNEXT_DMAW_*`); `byte` and `release` are the steps' one-shots */
export const DmaWatchKind = {
  Enable: 0,
  Load: 1,
  End: 2,
  Byte: 3,
  Count: 4,
  Write: 5,
  Held: 6,
  Problem: 7,
  Release: 8
} as const;

/** The setup problems a `problem` hit names (`ZXNEXT_DMAP_*`) */
export const DmaProblem = { Deaf: 1, BecomesDeaf: 2, Ignored: 3, NoLoad: 4 } as const;

const KIND_WATCH: Record<DmaStopKind, number> = {
  enable: DmaWatchKind.Enable,
  load: DmaWatchKind.Load,
  end: DmaWatchKind.End,
  count: DmaWatchKind.Count,
  write: DmaWatchKind.Write,
  held: DmaWatchKind.Held,
  problem: DmaWatchKind.Problem
};

/** A number: `$` hex or plain decimal */
function parseNumber(text: string): number {
  if (text.startsWith("$")) return /^\$[0-9a-f]+$/.test(text) ? parseInt(text.slice(1), 16) : NaN;
  return /^\d+$/.test(text) ? parseInt(text, 10) : NaN;
}

/** Parses the part after `dma:` (`end`, `count:256`, `write:$4000-$5aff`, `held:70000`) */
export function parseDmaStop(spec: string): DmaStop | { error: DmaStopParseError } {
  const parts = spec.trim().toLowerCase().split(":");
  const kind = parts[0] as DmaStopKind;
  if (!KINDS.includes(kind)) return { error: "kind" };
  const rest = parts.slice(1);
  switch (kind) {
    case "count": {
      if (rest.length !== 1) return { error: rest.length === 0 ? "count" : "extra" };
      const count = parseNumber(rest[0]);
      return Number.isFinite(count) && count >= 1 && count <= 0x10000 ? { kind, count } : { error: "count" };
    }
    case "held": {
      if (rest.length !== 1) return { error: rest.length === 0 ? "limit" : "extra" };
      const limit = parseNumber(rest[0]);
      return Number.isFinite(limit) && limit >= 1 && limit <= 0xffffff ? { kind, limit } : { error: "limit" };
    }
    case "write": {
      if (rest.length !== 1) return { error: rest.length === 0 ? "address" : "extra" };
      const [a, b] = rest[0].split("-");
      const from = parseNumber(a);
      const to = b === undefined ? from : parseNumber(b);
      if (!Number.isFinite(from) || !Number.isFinite(to) || from > 0xffff || to > 0xffff || to < from) return { error: "address" };
      return { kind, from, to };
    }
    default:
      return rest.length === 0 ? { kind } : { error: "extra" };
  }
}

const hex4 = (v: number) => `$${(v & 0xffff).toString(16).padStart(4, "0")}`;

/** The normalized spec stored in `BreakpointInfo.dmaStop` (no `dma:` prefix) */
export function formatDmaStop(stop: DmaStop): string {
  switch (stop.kind) {
    case "count":
      return `count:${stop.count}`;
    case "held":
      return `held:${stop.limit}`;
    case "write":
      return stop.from === stop.to ? `write:${hex4(stop.from!)}` : `write:${hex4(stop.from!)}-${hex4(stop.to!)}`;
    default:
      return stop.kind;
  }
}

/** Parses a stored spec; undefined when it no longer parses (never stops) */
export function dmaStopOf(spec: string | undefined): DmaStop | undefined {
  if (spec === undefined) return undefined;
  const parsed = parseDmaStop(spec);
  return "error" in parsed ? undefined : parsed;
}

/** The core's watch (`zxnextSetDmaWatch`, `zxnextSetDmaWatchSlot`) */
export type DmaWatch = {
  kinds: number;
  heldLimit: number;
  /** Up to four count targets (0: none) */
  counts: number[];
  /** Up to four write ranges */
  writes: { from: number; to: number }[];
};

export const DMA_WATCH_SLOTS = 4;

/**
 * The watch to arm for these stops, plus a pending step's one-shot (`byte`, `end`, `release`). Exact for
 * the first four count targets and write ranges; `held` uses the smallest limit and
 * `matchesDmaStop` applies each stop's own. 0 kinds disarms.
 */
export function buildDmaWatch(stops: DmaStop[], step?: DmaStepMode): DmaWatch {
  let kinds = 0;
  let heldLimit = 0;
  const counts: number[] = [];
  const writes: { from: number; to: number }[] = [];
  for (const s of stops) {
    kinds |= 1 << KIND_WATCH[s.kind];
    if (s.kind === "count" && counts.length < DMA_WATCH_SLOTS && !counts.includes(s.count!)) counts.push(s.count!);
    if (s.kind === "write" && writes.length < DMA_WATCH_SLOTS) writes.push({ from: s.from!, to: s.to! });
    if (s.kind === "held") heldLimit = heldLimit === 0 ? s.limit! : Math.min(heldLimit, s.limit!);
  }
  if (step === "byte") kinds |= 1 << DmaWatchKind.Byte;
  if (step === "block") kinds |= 1 << DmaWatchKind.End;
  if (step === "release") kinds |= 1 << DmaWatchKind.Release;
  return { kinds, heldLimit, counts, writes };
}

/** A latched hit, decoded from the core's 16-byte record */
export type DmaHit = {
  kind: number;
  problem: number;
  /** The bytes the block had moved */
  moved: number;
  src: number;
  dest: number;
  /** write: the address written */
  address: number;
  /** The instruction's PC (a port write), or the next instruction's (inside a transfer) */
  pc: number;
  /** held: the CPU T-states the bus was held */
  heldTacts: number;
};

export function decodeDmaHit(b: Uint8Array): DmaHit {
  return {
    kind: b[0],
    problem: b[1],
    moved: b[2] | (b[3] << 8),
    src: b[4] | (b[5] << 8),
    dest: b[6] | (b[7] << 8),
    address: b[8] | (b[9] << 8),
    pc: b[10] | (b[11] << 8),
    heldTacts: (b[12] | (b[13] << 8) | (b[14] << 16) | (b[15] << 24)) >>> 0
  };
}

/** Does this hit satisfy this stop? */
export function matchesDmaStop(stop: DmaStop, hit: DmaHit, coreHeldLimit = 0): boolean {
  if (hit.kind !== KIND_WATCH[stop.kind]) return false;
  switch (stop.kind) {
    case "count":
      return hit.moved === stop.count;
    case "write":
      return hit.address >= stop.from! && hit.address <= stop.to!;
    case "held":
      // --- the core reports a hold once, at the smallest limit; a stop with a larger one never sees it
      return (stop.limit ?? 0) <= Math.max(coreHeldLimit, 1);
    default:
      return true;
  }
}

/** The DMA step a command arms */
export type DmaStepMode = "byte" | "block" | "release";

/** The breakpoint key's argument part, upper case (`COUNT:256`) */
export function dmaStopKeyPart(spec: string): string {
  return spec.toUpperCase();
}

const hex4u = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

const PROBLEM_TEXT: Record<number, string> = {
  [DmaProblem.Deaf]: "a byte written while the DMA is deaf (WR4 bit 4) was ignored",
  [DmaProblem.BecomesDeaf]: "WR4 bit 4 without port B's address left the DMA deaf until a reset",
  [DmaProblem.Ignored]: "a byte that matches no register group was ignored",
  [DmaProblem.NoLoad]: "the DMA was enabled after new start addresses without a load ($CF)"
};

/**
 * The Emulator output's line for a DMA stop or step. English, like every stop message (output is not
 * translated).
 */
export function describeDmaStop(hit: DmaHit & { partition?: number }, partitionLabels?: Record<number, string>): string {
  const paged = hit.partition === undefined ? "" : ` in ${partitionLabels?.[hit.partition] ?? hit.partition}`;
  const at = `${hex4u(hit.pc)}${paged}`;
  const where = `${hit.moved} ${hit.moved === 1 ? "byte" : "bytes"} moved, next ${hex4u(hit.src)} → ${hex4u(hit.dest)}`;
  switch (hit.kind) {
    case DmaWatchKind.Enable:
      return `DMA stop: enabled by the instruction at ${at}`;
    case DmaWatchKind.Load:
      return `DMA stop: $CF (load) written by the instruction at ${at}`;
    case DmaWatchKind.End:
      return `DMA stop: end of block (${where}); the CPU continues at ${at}`;
    case DmaWatchKind.Byte:
      return `DMA step: one byte (${where}); the CPU continues at ${at}`;
    case DmaWatchKind.Count:
      return `DMA stop: ${hit.moved} bytes moved (next ${hex4u(hit.src)} → ${hex4u(hit.dest)}); the CPU continues at ${at}`;
    case DmaWatchKind.Write:
      return `DMA stop: the DMA wrote ${hex4u(hit.address)} (${where}); the CPU continues at ${at}`;
    case DmaWatchKind.Held:
      return `DMA stop: the DMA has held the bus for ${hit.heldTacts} T-states (${where}); the CPU continues at ${at}`;
    case DmaWatchKind.Problem:
      return `DMA stop: ${PROBLEM_TEXT[hit.problem] ?? "a setup problem"}, at ${at}`;
    case DmaWatchKind.Release:
      return `DMA step: the DMA let go of the bus (${where}); the CPU continues at ${at}`;
    default:
      return `DMA stop at ${at}`;
  }
}

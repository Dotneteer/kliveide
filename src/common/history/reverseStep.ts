import { classifyFlow, type FlowInfo } from "./flowKind";
import { HistoryKind, type HistoryRecord } from "./historyRecord";
import type { HistoryServiceSpan } from "./serviceSpans";

/*
 * Walking backwards (and forwards) through the execution history: the pure half of G4.3's lite step
 * back (`.plans/LITE_STEP_BACK_PLAN.md` §4.2). Everything here reads records by sequence number
 * through `HistoryWalkSource`, so the tests feed arrays and the emulator feeds the ring.
 *
 * **Where the cursor stands.** A cursor at sequence *s* shows the state *before* record *s* ran (a
 * record holds the registers before its event, G4.1 D3). `null` is the present: the live machine,
 * after the newest record.
 *
 * **Pairing calls with returns** (D9, T3): by instruction kind with a depth counter, never by SP
 * alone. Walking back, a taken return goes one level deeper and a taken call (CALL, CALL cc, RST)
 * one level shallower. An interrupt service that ran to its end - an INT or NMI and the instructions
 * up to the one that left it (`serviceSpans.ts`, whose exit test copes with the ZX81's `JP (HL)`) - is
 * one opaque step: the walk jumps over it whole, so the service's own calls and returns never
 * disturb the count. A service the start position is inside is not skipped: its INT or NMI record is
 * then the "call" that entered the current routine (T8). SP is only a consistency check: when it
 * disagrees with the pairing, the result says `uncertain` rather than guessing again.
 */

/** Reads records by sequence number; the walkers never look outside `[oldest, newest]` */
export interface HistoryWalkSource {
  /** The oldest record held */
  readonly oldest: number;
  /** The newest record held; `newest < oldest` when the ring is empty */
  readonly newest: number;
  /** The live PC: what follows the newest record (it decides whether that record's branch was taken) */
  readonly livePc: number;
  /** The live SP */
  readonly liveSp: number;
  /** The record with this sequence number; undefined when it is not held */
  record(sequence: number): HistoryRecord | undefined;
}

/** A cursor position: a sequence number, or `null` for the present */
export type HistoryPosition = number | null;

/** Why a walk did not get where it was asked to go */
export type HistoryWalkReason =
  /** Nothing earlier to go to: the walk stopped at the start of recorded history (T7) */
  | "start"
  /** Already at the present: there is nothing later */
  | "present"
  /** The ring holds no records */
  | "empty"
  /** Reverse Continue found no breakpoint hit before the start of recorded history */
  | "noHit"
  /** Reverse Step Out found no call that entered the current routine */
  | "noCall";

export type HistoryWalkResult = {
  /** Where the cursor goes (`null`: the present) */
  position: HistoryPosition;
  /** Whether that differs from where it was */
  moved: boolean;
  reason?: HistoryWalkReason;
  /** The call/return pairing disagreed with SP (T3): the result is the best candidate */
  uncertain?: boolean;
};

export type HistoryWalkOptions = {
  /**
   * The outermost interrupt service spans of the held records (`HistoryServiceSpan`). Reverse step
   * over, step out and the call stack always treat a complete service as one step; Step Back and
   * Step Forward only when `foldServices` is set.
   */
  services?: readonly HistoryServiceSpan[];
  /** Step Back and Step Forward pass over a whole interrupt service (D8, the document's folding) */
  foldServices?: boolean;
  /**
   * Where a step may stop. By default an instruction or a HALT (D8: INT, NMI, forced-NOP and DMA
   * records are not stops); statement-level stepping (D12) narrows it to statement entries.
   */
  isStop?: (record: HistoryRecord) => boolean;
  /** At most this many records are read per walk (the whole ring by default) */
  maxRecords?: number;
};

/** A stop of instruction-level stepping: an instruction, or a (coalesced) HALT */
export function isInstructionStop(record: HistoryRecord): boolean {
  return record.kind === HistoryKind.Instruction || record.kind === HistoryKind.Halt;
}

// =================================================================================================
// Helpers

/** The start of a walk backwards: one past the position */
function startOf(source: HistoryWalkSource, from: HistoryPosition): number {
  return from === null ? source.newest + 1 : from;
}

/** The PC after a record: the next record's, or the live PC after the newest */
function nextPcOf(source: HistoryWalkSource, sequence: number): number | undefined {
  return sequence >= source.newest ? source.livePc : source.record(sequence + 1)?.regs.pc;
}

/** The SP at a position (the state before that record, or the live SP for the present) */
function spAt(source: HistoryWalkSource, sequence: number): number | undefined {
  return sequence > source.newest ? source.liveSp : source.record(sequence)?.regs.sp;
}

/** How a record moves the call depth: +1 enters a routine, -1 leaves one, 0 neither */
function depthEffect(flow: FlowInfo): -1 | 0 | 1 {
  switch (flow.kind) {
    case "call":
      return flow.taken === false ? 0 : 1;
    case "rst":
    case "int":
    case "nmi":
      return 1;
    case "ret":
      return flow.taken === false ? 0 : -1;
    default:
      return 0;
  }
}

/** Finds a span by sequence: the spans are sorted and do not overlap */
class SpanIndex {
  private readonly firsts: number[];
  constructor(private readonly spans: readonly HistoryServiceSpan[]) {
    this.firsts = spans.map((s) => s.first);
  }

  /** The span holding `sequence`, if any */
  containing(sequence: number): HistoryServiceSpan | undefined {
    let lo = 0;
    let hi = this.firsts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.firsts[mid] <= sequence) lo = mid + 1;
      else hi = mid - 1;
    }
    const span = hi >= 0 ? this.spans[hi] : undefined;
    return span && sequence <= span.last ? span : undefined;
  }
}

/** Spans a walk from `start` jumps over: every complete service except one holding the start */
function skippableSpans(options: HistoryWalkOptions, start: number) {
  const index = new SpanIndex(options.services ?? []);
  const own = index.containing(start);
  return (sequence: number) => {
    const span = index.containing(sequence);
    return span && span !== own ? span : undefined;
  };
}

/** The oldest stop held, for a walk that ran off the start of the ring (T7) */
function oldestStop(source: HistoryWalkSource, isStop: (r: HistoryRecord) => boolean, limit: number): number | undefined {
  for (let s = source.oldest; s <= source.newest && s < source.oldest + limit; s++) {
    const r = source.record(s);
    if (r && isStop(r)) return s;
  }
  return undefined;
}

/** The result of a walk that found nothing: the oldest stop, or no move at all */
function ranOffStart(
  source: HistoryWalkSource,
  from: HistoryPosition,
  isStop: (r: HistoryRecord) => boolean,
  limit: number,
  reason: HistoryWalkReason
): HistoryWalkResult {
  if (source.newest < source.oldest) return { position: from, moved: false, reason: "empty" };
  const oldest = oldestStop(source, isStop, limit);
  if (oldest === undefined || (from !== null && oldest >= from)) {
    return { position: from, moved: false, reason };
  }
  return { position: oldest, moved: true, reason };
}

function limitOf(source: HistoryWalkSource, options: HistoryWalkOptions): number {
  return options.maxRecords ?? Math.max(0, source.newest - source.oldest + 1);
}

// =================================================================================================
// Step Back and Step Forward (D8)

/** The previous stop before the position */
export function stepBack(
  source: HistoryWalkSource,
  from: HistoryPosition,
  options: HistoryWalkOptions = {}
): HistoryWalkResult {
  const isStop = options.isStop ?? isInstructionStop;
  const limit = limitOf(source, options);
  const start = startOf(source, from);
  const skip = options.foldServices ? skippableSpans(options, start) : () => undefined;
  let read = 0;
  for (let s = Math.min(start - 1, source.newest); s >= source.oldest && read < limit; s--, read++) {
    const span = skip(s);
    if (span) {
      s = span.first;
      continue;
    }
    const r = source.record(s);
    if (r && isStop(r)) return { position: s, moved: true };
  }
  if (source.newest < source.oldest) return { position: from, moved: false, reason: "empty" };
  return { position: from, moved: false, reason: "start" };
}

/** The next stop after the position, or the present after the newest */
export function stepForward(
  source: HistoryWalkSource,
  from: HistoryPosition,
  options: HistoryWalkOptions = {}
): HistoryWalkResult {
  if (from === null) return { position: null, moved: false, reason: "present" };
  const isStop = options.isStop ?? isInstructionStop;
  const limit = limitOf(source, options);
  const skip = options.foldServices ? skippableSpans(options, from) : () => undefined;
  let read = 0;
  for (let s = Math.max(from + 1, source.oldest); s <= source.newest && read < limit; s++, read++) {
    const span = skip(s);
    if (span) {
      s = span.last;
      continue;
    }
    const r = source.record(s);
    if (r && isStop(r)) return { position: s, moved: true };
  }
  return { position: null, moved: true };
}

// =================================================================================================
// Reverse Step Over and Reverse Step Out (D9)

/**
 * Walks back from the position, tracking the call depth relative to it, and returns the first
 * stop the predicate accepts at its depth. A record's depth is the depth it ran at: a return runs
 * inside the routine it leaves, a call in the routine it calls from.
 */
function walkWithDepth(
  source: HistoryWalkSource,
  from: HistoryPosition,
  options: HistoryWalkOptions,
  accept: (depth: number) => boolean
): { sequence: number; depth: number } | undefined {
  const isStop = options.isStop ?? isInstructionStop;
  const limit = limitOf(source, options);
  const start = startOf(source, from);
  const skip = skippableSpans(options, start);
  let depth = 0;
  let read = 0;
  for (let s = Math.min(start - 1, source.newest); s >= source.oldest && read < limit; s--, read++) {
    const span = skip(s);
    if (span) {
      // --- A complete interrupt service is transparent: depth unchanged, nothing in it is a stop
      s = span.first;
      continue;
    }
    const r = source.record(s);
    if (!r) break;
    const effect = depthEffect(classifyFlow(r, nextPcOf(source, s)));
    if (effect < 0) depth++;
    else if (effect > 0) depth--;
    if (accept(depth) && isStop(r)) return { sequence: s, depth };
  }
  return undefined;
}

/** The SP check (T3): a call record's SP is the SP after its matching return */
function overIsUncertain(source: HistoryWalkSource, target: number, start: number): boolean {
  const before = source.record(target);
  if (!before) return false;
  const flow = classifyFlow(before, nextPcOf(source, target));
  if (depthEffect(flow) <= 0) return false;
  // --- The target is a call that was stepped over: SP is back where it was before it
  const after = spAt(source, start);
  return after !== undefined && after !== before.regs.sp;
}

/**
 * Reverse Step Over: as Step Back, but a call that returned just before the position is passed
 * over whole, back to the call instruction itself
 */
export function stepBackOver(
  source: HistoryWalkSource,
  from: HistoryPosition,
  options: HistoryWalkOptions = {}
): HistoryWalkResult {
  if (source.newest < source.oldest) return { position: from, moved: false, reason: "empty" };
  const found = walkWithDepth(source, from, options, (depth) => depth <= 0);
  if (!found) {
    return ranOffStart(source, from, options.isStop ?? isInstructionStop, limitOf(source, options), "start");
  }
  // --- Only a call passed over whole (depth 0) has a return to check SP against
  const uncertain = found.depth === 0 && overIsUncertain(source, found.sequence, startOf(source, from));
  return { position: found.sequence, moved: true, ...(uncertain ? { uncertain } : {}) };
}

/** Reverse Step Out: back to the call (or interrupt) that entered the routine holding the position */
export function stepBackOut(
  source: HistoryWalkSource,
  from: HistoryPosition,
  options: HistoryWalkOptions = {}
): HistoryWalkResult {
  if (source.newest < source.oldest) return { position: from, moved: false, reason: "empty" };
  const found = walkWithDepth(source, from, options, (depth) => depth < 0);
  if (!found) {
    return ranOffStart(source, from, options.isStop ?? isInstructionStop, limitOf(source, options), "noCall");
  }
  // --- Inside a routine SP is below the call's (the return address is on the stack)
  const inside = spAt(source, startOf(source, from));
  const callSp = source.record(found.sequence)?.regs.sp;
  const uncertain = inside !== undefined && callSp !== undefined && ((callSp - inside) & 0xffff) >= 0x8000;
  return { position: found.sequence, moved: true, ...(uncertain ? { uncertain } : {}) };
}

// =================================================================================================
// Reverse Continue (D11)

/**
 * Reverse Continue: the most recent stop before the position that `isHit` accepts. Interrupt
 * services are searched too: a breakpoint inside one is a hit like any other.
 * @param isHit Decides a hit from the record (its address, partition and registers)
 */
export function reverseContinue(
  source: HistoryWalkSource,
  from: HistoryPosition,
  isHit: (record: HistoryRecord) => boolean,
  options: HistoryWalkOptions = {}
): HistoryWalkResult {
  const isStop = options.isStop ?? isInstructionStop;
  const limit = limitOf(source, options);
  const start = startOf(source, from);
  let read = 0;
  for (let s = Math.min(start - 1, source.newest); s >= source.oldest && read < limit; s--, read++) {
    const r = source.record(s);
    if (r && isStop(r) && isHit(r)) return { position: s, moved: true };
  }
  return ranOffStart(source, from, isStop, limit, "noHit");
}

// =================================================================================================
// The historical call stack (D10)

export type HistoricalFrame = {
  /** The sequence of the call, RST, INT or NMI record that entered the frame */
  sequence: number;
  kind: "call" | "rst" | "int" | "nmi";
  /** The call instruction's address (for an interrupt: the interrupted address) */
  callSite: number;
  /** Where the frame returns to */
  returnAddress: number;
  /** SP before the call: the return address went to SP-2 */
  sp: number;
  /** The record's context, for the partition of the call site */
  context: Uint8Array;
};

export type HistoricalCallStack = {
  /** Innermost first */
  frames: HistoricalFrame[];
  /**
   * The walk reached the start of recorded history: outer frames older than the ring are not
   * known ("… earlier frames before recorded history")
   */
  incomplete: boolean;
};

/** The chain of active calls at a position, innermost first, reconstructed from the records */
export function historicalCallStack(
  source: HistoryWalkSource,
  from: HistoryPosition,
  options: HistoryWalkOptions & { maxFrames?: number } = {}
): HistoricalCallStack {
  const frames: HistoricalFrame[] = [];
  if (source.newest < source.oldest) return { frames, incomplete: true };
  const limit = limitOf(source, options);
  const maxFrames = options.maxFrames ?? 64;
  const start = startOf(source, from);
  const skip = skippableSpans(options, start);
  let depth = 0;
  let read = 0;
  for (let s = Math.min(start - 1, source.newest); s >= source.oldest && read < limit; s--, read++) {
    const span = skip(s);
    if (span) {
      s = span.first;
      continue;
    }
    const r = source.record(s);
    if (!r) break;
    const flow = classifyFlow(r, nextPcOf(source, s));
    const effect = depthEffect(flow);
    if (effect < 0) {
      depth++;
    } else if (effect > 0) {
      if (depth > 0) {
        depth--;
        continue;
      }
      // --- A call still active at the position: a frame of the stack
      const kind = flow.kind as HistoricalFrame["kind"];
      const pc = r.regs.pc;
      frames.push({
        sequence: s,
        kind,
        callSite: pc,
        returnAddress:
          kind === "int" || kind === "nmi" ? pc : (pc + (kind === "rst" ? 1 : 3)) & 0xffff,
        sp: r.regs.sp,
        context: r.context
      });
      if (frames.length >= maxFrames) return { frames, incomplete: false };
    }
  }
  // --- The walk ran to the start of recorded history: what called the outermost frame is unknown
  return { frames, incomplete: true };
}

// =================================================================================================
// Reading records for the walkers

/**
 * A `HistoryWalkSource` over a page reader, decoding each record once: the emulator side wraps its
 * ring reader in one per navigation.
 */
export class PagedHistorySource implements HistoryWalkSource {
  private readonly cache = new Map<number, HistoryRecord[]>();

  /**
   * @param read Reads up to `count` decoded records from `from` on
   * @param pageSize Records per read
   */
  constructor(
    readonly oldest: number,
    readonly newest: number,
    readonly livePc: number,
    readonly liveSp: number,
    private readonly read: (from: number, count: number) => HistoryRecord[],
    private readonly pageSize = 1024
  ) {}

  record(sequence: number): HistoryRecord | undefined {
    if (sequence < this.oldest || sequence > this.newest) return undefined;
    const pageStart = this.oldest + Math.floor((sequence - this.oldest) / this.pageSize) * this.pageSize;
    let page = this.cache.get(pageStart);
    if (!page) {
      page = this.read(pageStart, Math.min(this.pageSize, this.newest - pageStart + 1));
      this.cache.set(pageStart, page);
    }
    return page[sequence - pageStart];
  }
}

/** A `HistoryWalkSource` over an array of consecutive records (tests, small fixtures) */
export function arrayHistorySource(
  records: readonly HistoryRecord[],
  live: { pc: number; sp: number }
): HistoryWalkSource {
  const oldest = records.length ? records[0].sequence : 1;
  return {
    oldest,
    newest: records.length ? records[records.length - 1].sequence : 0,
    livePc: live.pc,
    liveSp: live.sp,
    record: (sequence) => records[sequence - oldest]
  };
}

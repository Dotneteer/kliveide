import type { AppState } from "@state/AppState";
import type { Store } from "@state/redux-light";
import type {
  BreakpointInfo,
  BreakpointScope,
  LogDialect,
  LogpointGroupState
} from "@abstractions/BreakpointInfo";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";
import type { SourceStep } from "./SourceStepDecision";

import type { CompiledCondition, ConditionAccessKind, ConditionSymbols } from "@common/utils/breakpoint-condition/condition-types";
import type { ConditionMachineInfo, ConditionStore } from "./conditionStore";
import type {
  CompiledLogTemplate,
  LogValue
} from "@common/utils/breakpoint-condition/logpoint-template";
import type { ConditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";

import { incBreakpointHitsVersionAction, incBreakpointsVersionAction } from "@state/actions";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import {
  breakpointFiltersOf,
  effectiveHitMode,
  effectiveLogDialect,
  hasBreakpointFilters,
  isLogpoint
} from "@common/utils/breakpoint-filters";
import {
  bindCondition,
  compileCondition,
  compileConditionWith
} from "@common/utils/breakpoint-condition/condition-checker";
import { parseDezogExpression } from "@common/utils/breakpoint-condition/dezog/dezog-parser";
import type { SyntaxNode } from "@common/utils/breakpoint-condition/condition-parser";
import {
  CondEnv,
  NO_VALUE,
  emitCondition,
  usesConditionEnv
} from "@common/utils/breakpoint-condition/condition-bytecode";
import {
  bindLogTemplate,
  compileLogTemplate,
  logGroupOf,
  renderLogTemplate
} from "@common/utils/breakpoint-condition/logpoint-template";
import { ConditionResult } from "./conditionStore";
import {
  bankRelativeAddresses,
  bankRelativePartition,
  breakpointMatchesScope,
  effectiveBankSite,
  isBankRelative,
  isCopperBreakpoint,
  isEventBreakpoint,
  isNextRegBreakpoint,
  isSpriteBreakpoint,
  spriteAttrMaskOf,
  withScopeOwner
} from "@common/utils/breakpoint-scope";

// --- Breakpoint flags
// --- Execution breakpoint
export const EXEC_BP = 0x01;
// --- Has partition information
export const PART_BP = 0x02;
// --- Has hit count information
export const HIT_BP = 0x04;
// --- Memory read breakpoint
export const MEM_READ_BP = 0x08;
// --- Memory write breakpoint
export const MEM_WRITE_BP = 0x10;
// --- I/O read breakpoint
export const IO_READ_BP = 0x20;
// --- I/O write breakpoint
export const IO_WRITE_BP = 0x40;
// --- Execution breakpoint disabled?
export const DIS_EXEC_BP = 0x80;
// --- Memory read breakpoint disabled?
export const DIS_MR_BP = 0x100;
// --- Memory write breakpoint disabled?
export const DIS_MW_BP = 0x200;
// --- I/O read breakpoint disabled?
export const DIS_IOR_BP = 0x400;
// --- I/O write breakpoint disabled?
export const DIS_IOW_BP = 0x800;
/*
 * At least one breakpoint here has a condition or a hit-count rule
 * (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.5). The stop decision for such an address takes the
 * slow path - every claiming definition is evaluated and counted - while every other address keeps
 * the flag-only fast path, with no context, no register sync and no allocation.
 *
 * May be left stale on a port address after an I/O breakpoint is removed (the bulk I/O paths do
 * not re-derive). That only costs speed: the slow path decides from the definitions.
 *
 * A logpoint (`.plans/LOGPOINTS_PLAN.md` §4.2) sets it too: "log and continue" is one more outcome
 * of the same per-definition walk.
 */
export const COND_BP = 0x1000;

/** At most this many log lines are queued between two drains - one frame (L9, Q10). */
export const LOG_LINES_PER_FRAME = 256;

/** One line a logpoint produced, waiting to be sent to the IDE's Log pane (L8). */
export type LogLine = {
  /** The logpoint's group, upper-case. */
  group: string;
  /** The filled-in message. */
  text: string;
  /** Where it fired: the PC for an execution logpoint, the accessed address or port otherwise. */
  address: number;
  /** The logpoint's storage key. */
  key: string;
};

/** Which access a stop decision is about; selects the definitions that can match. */
type DecisionKind = "exec" | "memRead" | "memWrite" | "ioRead" | "ioWrite";

/** What a reverse-debugging keyframe keeps of the breakpoints (`.plans/REVERSE_DEBUGGING_PLAN.md` D16) */
export type DebugTimelineState = {
  /** Hit counters that are not zero, by storage key */
  hits: [string, number][];
  /** The one-shot definitions that existed */
  oneShots: BreakpointInfo[];
};

/** Per-definition runtime state, keyed by storage key; never persisted (plan §4.5, C12). */
type BreakpointRuntimeState = {
  /** Condition-true hits since the last restart or reset. */
  hits: number;
  /** The condition text `compiled`/`error` were built from. */
  compiledFor?: string;
  /** ...and its dialect (an `ASSERTION` comment's is DeZog's). */
  compiledDialect?: LogDialect;
  /** The access kind they were built for (decides `VAL`/`ADDR`). */
  compiledKind?: ConditionAccessKind;
  /** The machine-facts generation they were built against. */
  compiledStamp?: number;
  compiled?: CompiledCondition;
  /** Set when the condition does not compile (C15): the breakpoint then stops every time. */
  error?: string;
  /** Where its program is in the core's store; unset until the store is (re)built. */
  slot?: number;
  /** The store had no room for its program: it then stops every time, and says why. */
  overflow?: boolean;
  /** The condition reads a fact written before evaluation (`cpufreq()`, `frame()`). */
  conditionUsesEnv?: boolean;

  // --- A logpoint's template (`.plans/LOGPOINTS_PLAN.md` §4.2), built like the condition
  templateFor?: string;
  templateDialect?: LogDialect;
  templateKind?: ConditionAccessKind;
  templateStamp?: number;
  template?: CompiledLogTemplate;
  /** The template did not compile: the logpoint logs this text instead of its message. */
  logError?: string;
  /** Each value placeholder's store slot, by segment index. */
  templateSlots?: (number | undefined)[];
  /** The store had no room for a placeholder's program. */
  logOverflow?: boolean;
};

/** The access an access breakpoint saw: `VAL` and `ADDR`. */
type AccessFacts = { value?: number; address?: number };

/*
 * The NextReg write watch table, a second registry beside `breakpointFlags`.
 *
 * It cannot live in `breakpointFlags`: that array is indexed by 16-bit address, and a NextReg
 * breakpoint has no address at all. Three 256-byte rows - flags, value, mask - laid out exactly as
 * the ZX Spectrum Next core's `zxnextNextRegWatch` expects, so the whole thing crosses the WASM
 * boundary in one `.set()`.
 */
export const NEXTREG_WATCH_CPU = 0x01;
export const NEXTREG_WATCH_COPPER = 0x02;
const NEXTREG_WATCH_ROW = 0x100;
const NEXTREG_WATCH_SIZE = NEXTREG_WATCH_ROW * 3;

/** The Copper-instruction watch: 1024 list indexes, one bit each (`zxnextCopperWatch`). */
const COPPER_WATCH_SIZE = 128;

/** The sprite-attribute watch: one byte per sprite, bits 0-4 the watched attribute bytes (`zxnextSpriteWatch`). */
const SPRITE_WATCH_SIZE = 128;

/**
 * This class implement support functions for debugging
 */
export class DebugSupport implements IDebugSupport {
  // --- Breakpoint definitions
  breakpointDefs = new Map<string, BreakpointInfo>();
  breakpointFlags = new Uint16Array(0x1_0000);
  breakpointData = new Map<number, BreakpointData>();

  /** The NextReg write watch table; see `buildNextRegWatch`. One block, so one `.set()` pushes it. */
  readonly nextRegWatch = new Uint8Array(NEXTREG_WATCH_SIZE);
  // --- Named windows onto the single block above. `subarray` shares the buffer, so writing through
  // --- these lands in `nextRegWatch` itself - the readable names cost nothing.
  private readonly nextRegWatchFlags = this.nextRegWatch.subarray(0, NEXTREG_WATCH_ROW);
  private readonly nextRegWatchValue = this.nextRegWatch.subarray(NEXTREG_WATCH_ROW, NEXTREG_WATCH_ROW * 2);
  private readonly nextRegWatchMask = this.nextRegWatch.subarray(NEXTREG_WATCH_ROW * 2, NEXTREG_WATCH_SIZE);

  /** The Copper watch table: one bit per list index, as `zxnextCopperWatch` expects. */
  readonly copperWatch = new Uint8Array(COPPER_WATCH_SIZE);

  /** The sprite-attribute watch table: one byte per sprite, as `zxnextSpriteWatch` expects. */
  readonly spriteWatch = new Uint8Array(SPRITE_WATCH_SIZE);

  private suspendVersionIncrement = false;

  /** Per-definition hit counters and compiled conditions; see `BreakpointRuntimeState`. */
  private readonly runtime = new Map<string, BreakpointRuntimeState>();

  /** A counter moved since `takeHitsChanged` last asked. */
  private hitsChanged = false;

  /**
   * Called with a definition's storage key whenever its hit counter moves: the reverse-debugging
   * timeline logs it with the position, so a replay - which runs without breakpoints - can put the
   * counters where the recorded run had them (`.plans/REVERSE_DEBUGGING_PLAN.md` D16, T8).
   */
  onHitCounted?: (key: string) => void;

  /** The hit counters and the one-shot definitions, for a reverse-debugging keyframe (D16) */
  captureTimelineState(): DebugTimelineState {
    const hits: [string, number][] = [];
    for (const [key, state] of this.runtime) if (state.hits > 0) hits.push([key, state.hits]);
    const oneShots: BreakpointInfo[] = [];
    for (const bp of this.breakpointDefs.values()) if (bp.oneShot) oneShots.push({ ...bp });
    return { hits, oneShots };
  }

  /**
   * Puts the hit counters where a keyframe had them, plus `extraHits` (the logged hits between the
   * keyframe and the replay target), and brings back one-shots the keyframe had that fired since.
   * Definitions that no longer exist are skipped; a counter of a definition the keyframe did not
   * know starts at its extra hits.
   */
  restoreTimelineState(state: DebugTimelineState, extraHits?: ReadonlyMap<string, number>): void {
    for (const bp of state.oneShots) {
      if (!this.breakpointDefs.has(getBreakpointStorageKey(bp))) this.addBreakpoint({ ...bp });
    }
    const base = new Map(state.hits);
    const hitsOf = (key: string) => (base.get(key) ?? 0) + (extraHits?.get(key) ?? 0);
    for (const [key, runtime] of this.runtime) runtime.hits = hitsOf(key);
    for (const key of new Set([...base.keys(), ...(extraHits?.keys() ?? [])])) {
      if (!this.runtime.has(key) && this.breakpointDefs.has(key)) this.runtime.set(key, { hits: hitsOf(key) });
    }
    this.hitsChanged = true;
  }

  /** The machine facts conditions are compiled against; `setConditionEnvironment` sets them. */
  private conditionFacts: ConditionMachineFacts = { isZ80: true };
  /** Bumped by `setConditionEnvironment`, so compiled conditions are rebuilt for the new facts. */
  private conditionStamp = 0;
  /** The program symbols labels bind to; `setConditionSymbols` replaces them (§3.6). */
  private conditionSymbols: ConditionSymbols = {};

  /**
   * The machine's condition evaluator: the program store of its core, where the shared C evaluator
   * (`src/emu/z80/wasm/z80-condition.c`) runs a condition next to the registers - no copy crosses
   * the WASM boundary (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`). Set once per machine
   * (`connectConditionSupport`); absent on a machine without one, where a condition fails safe.
   */
  conditionStoreProvider?: () => ConditionStore | undefined;

  /** The store needs rebuilding: a program was compiled, re-bound or dropped since the last build. */
  private storeDirty = true;
  /** The token the last rebuild wrote into the store; a store not carrying it is rebuilt. */
  private storeToken = 0;

  /**
   * The machine facts the core does not keep itself - the clock, the frame counter, the slot map
   * (`.plans/LOGPOINTS_PLAN.md` §3.5). Set with the condition store (`connectConditionSupport`).
   */
  machineInfo?: ConditionMachineInfo;

  /**
   * Logpoints log once per **arrival** (L5): `shouldStopAtDebugPoint` sets this before asking about
   * an execution address. False on the instruction a run or step resumes from when the previous
   * decision was made at that same address (a pause, a step, a frame boundary landed there).
   */
  logArrival = true;

  /** The PC of the last stop decision; `undefined` after a machine start, so the first one logs. */
  lastDecisionPc?: number;

  /** Log lines waiting for the next drain (L8), and how many the cap dropped (L9). */
  private pendingLog: LogLine[] = [];
  private droppedLogLines = 0;

  /** Which logpoint groups log; see `setLogGroups`. */
  private logGroups: LogpointGroupState = { enabled: true };
  /** The store value `logGroups` was last taken from. */
  private logGroupsFromStore?: LogpointGroupState;

  /**
   * While set, only session-owned breakpoints can stop the machine.
   *
   * This exists for a code-injection flow that ends with the machine already running. Loading a NEX
   * means booting NextZXOS and *typing* `.nexload` into it, and a keystroke is queued with an
   * absolute tact window: a user breakpoint that pauses the machine while strokes are still queued
   * expires every one that has not been pressed, leaving the command line half-written and the
   * program unloaded. Meanwhile the flow's own stop — the one-shot at the program's entry point —
   * still has to fire, which is the distinction this draws.
   *
   * `MachineController` owns the lifetime, and scopes it to the window that is actually exposed:
   * during the flow itself the machine runs in `NoDebug`, where the per-instruction callers skip
   * the stop decision entirely and no breakpoint can fire regardless of this flag.
   *
   * See `.plans/NEX_DEBUGGING_PLAN.md` §10.3.
   */
  suppressUserBreakpoints = false;

  /**
   * While `suppressUserBreakpoints` is set: whether the flow's keystrokes are still queued, asked at
   * the moment a breakpoint is hit. The flag itself is lifted by a poll, which can come late — by
   * then NextZXOS may have loaded the program and run it past its first breakpoint — so the
   * suppression holds only while there is really something left to type. Unset: the flag alone.
   */
  keystrokesPending?: () => boolean;

  /**
   * Initializes the service using the specified store
   * @param store Application state store
   */
  constructor(
    private readonly store?: Store<AppState>,
    bps?: BreakpointInfo[]
  ) {
    this.suspendVersionIncrement = true;
    try {
      if (bps) {
        bps.forEach((bp) => this.addBreakpoint(bp));
      }
    } finally {
      this.suspendVersionIncrement = false;
    }
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /**
   * This member stores the last startup breakpoint to check. It allows setting a breakpoint to the first
   * instruction of a program.
   */
  lastStartupBreakpoint?: number;

  /**
   * The list of current execution breakpoints
   */
  get breakpoints(): BreakpointInfo[] {
    return Array.from(this.breakpointDefs.values());
  }

  /**
   * Gets execution breakpoint information for the specified address/partition
   * @param address Breakpoint address
   */
  shouldStopAt(
    address: number,
    partitionResolver: (address: number) => number | undefined
  ): boolean {
    // --- Check breakpoint flags
    const flags = this.breakpointFlags[address];

    // --- Any execution breakpoint?
    if (!(flags & (EXEC_BP | PART_BP))) {
      // --- No execution breakpoint
      return false;
    }

    // --- During a launch flow only the flow's own stop may fire; see `suppressUserBreakpoints`.
    if (this.suppressUserBreakpoints && (this.keystrokesPending?.() ?? true) && !this.hasSessionStopAt(address)) {
      return false;
    }

    // --- A condition or a hit rule here: decide from the definitions (§4.5)
    if (flags & COND_BP) {
      return this.decideFiltered("exec", address, partitionResolver);
    }

    // --- Is there a partitionless breakpoint for this address?
    if (flags & EXEC_BP) {
      // --- Yes, though it may be disabled
      return !(flags & DIS_EXEC_BP);
    }

    // --- Is there any partition breakpoint?
    const bpData = this.breakpointData.get(address);
    if (!bpData?.partitions || bpData.partitions.length === 0) {
      // --- No partition breakpoint
      return false;
    }

    // --- Get the current partition and test if it has a breakpoint.
    //
    // --- `some`, not `find`: two entries can now share a partition at one address — a user's
    // --- `bp-set <partition>:<address>` and a bank-relative breakpoint projected onto it. Taking
    // --- the *first* would let a disabled one mask an enabled one. The question is whether any
    // --- enabled entry matches, which is also what the single-entry case always meant.
    const partition = partitionResolver(address);
    return bpData.partitions.some((p) => p[0] === partition && !p[1]);
  }

  /**
   * Gets memory read breakpoint information for the specified address/partition
   * @param reads Addresses read during the current instruction
   * @param length Number of bytes read
   * @param partitionResolver A function to resolve the current partition
   */
  hasMemoryRead(
    reads: ArrayLike<number>,
    length: number,
    partitionResolver: (address: number) => number | undefined,
    values?: ArrayLike<number>
  ): boolean {
    return this.hasMemoryAccess("memRead", reads, length, partitionResolver, values);
  }

  /**
   * Gets memory write breakpoint information for the specified address/partition
   * @param writes Addresses written during the current instruction
   * @param length Number of bytes written
   * @param partitionResolver A function to resolve the current partition
   * @param values The byte written to each address, for a condition's `VAL`
   */
  hasMemoryWrite(
    writes: ArrayLike<number>,
    length: number,
    partitionResolver: (address: number) => number | undefined,
    values?: ArrayLike<number>
  ): boolean {
    return this.hasMemoryAccess("memWrite", writes, length, partitionResolver, values);
  }

  /**
   * The memory read/write decision. **Every** access is examined, not just up to the first stop:
   * a conditional breakpoint counts its hits (C11), so an earlier match must not hide a later one,
   * and a disabled breakpoint at one address must not end the search at the next one (it used to
   * return false there).
   */
  private hasMemoryAccess(
    kind: "memRead" | "memWrite",
    addresses: ArrayLike<number>,
    length: number,
    partitionResolver: (address: number) => number | undefined,
    values?: ArrayLike<number>
  ): boolean {
    const kindBit = kind === "memRead" ? MEM_READ_BP : MEM_WRITE_BP;
    const disabledBit = kind === "memRead" ? DIS_MR_BP : DIS_MW_BP;
    let stop = false;
    for (let i = 0; i < length; i++) {
      const address = addresses[i];
      const flags = this.breakpointFlags[address];
      if (!(flags & kindBit)) continue;
      if (flags & COND_BP) {
        if (
          this.decideFiltered(kind, address, partitionResolver, {
            value: values?.[i],
            address
          })
        ) {
          stop = true;
        }
        continue;
      }
      if (stop || flags & disabledBit) continue;
      const bpData = this.breakpointData.get(address);
      if (!bpData?.partitions || bpData.partitions.length === 0) {
        stop = true;
        continue;
      }
      const partition = partitionResolver(address);
      if (bpData.partitions.some((p) => p[0] === partition && !p[1])) {
        stop = true;
      }
    }
    return stop;
  }

  /**
   * Does any breakpoint in this set watch memory or I/O access?
   *
   * The per-instruction debug loops of the WASM-backed machines call this once per entry to decide
   * whether they have to mirror the core's bus activity after every instruction. `breakpointDefs`
   * holds a handful of entries in practice, so this stays cheaper than the ~7 WASM boundary
   * crossings per instruction it lets the caller skip.
   */
  hasAccessBreakpoints(): boolean {
    for (const bp of this.breakpointDefs.values()) {
      if (bp.memoryRead || bp.memoryWrite || bp.ioRead || bp.ioWrite) {
        return true;
      }
    }
    return false;
  }

  /**
   * Does any breakpoint watch a Next Register write?
   *
   * The ZX Spectrum Next debug loop asks once per entry, as it does with `hasAccessBreakpoints`,
   * to decide whether to push the watch table into the core at all. On every other machine this is
   * always false and costs one walk of a handful of definitions.
   */
  hasNextRegBreakpoints(): boolean {
    for (const bp of this.breakpointDefs.values()) {
      if (isNextRegBreakpoint(bp) && !bp.disabled) {
        return true;
      }
    }
    return false;
  }

  /**
   * The watch table to hand the core: three 256-byte rows - flags, value, mask - laid out exactly
   * as `zxnextNextRegWatch` expects, so the caller pushes it with one `.set()`.
   *
   * **Rebuilt on every call rather than kept in step with edits.** Every other derived structure
   * here is invalidated from the fifteen places that mutate the set, and this file's own comments
   * record three bugs caused by one of those places forgetting. The debug loop asks for this once
   * per entry - fifty times a second at worst - and the walk is over a handful of definitions, so
   * paying for a rebuild buys away a whole class of missed-invalidation bug.
   *
   * **The table over-approximates on purpose.** One slot per register cannot hold two different
   * value filters, so when a register carries more than one the mask collapses to zero (match any)
   * and `hasNextRegWrite` makes the exact decision on the way back. This is the same deferral
   * `PART_BP` uses: the flag says "something here, ask properly".
   */
  buildNextRegWatch(): Uint8Array {
    this.nextRegWatch.fill(0);

    // --- `undefined` = nothing watches this register yet, `"any"` = it is already unfiltered.
    const filters = new Map<number, { value: number; mask: number } | "any">();

    for (const bp of this.breakpointDefs.values()) {
      if (!isNextRegBreakpoint(bp) || bp.disabled) continue;
      const reg = bp.nextReg! & 0xff;

      this.nextRegWatchFlags[reg] |= NEXTREG_WATCH_CPU;
      if (bp.nextRegCopper) this.nextRegWatchFlags[reg] |= NEXTREG_WATCH_COPPER;

      const wanted =
        bp.nextRegValue === undefined
          ? ("any" as const)
          : { value: bp.nextRegValue & 0xff, mask: (bp.nextRegMask ?? 0xff) & 0xff };
      const held = filters.get(reg);

      if (held === "any") continue;
      if (held === undefined) {
        filters.set(reg, wanted);
      } else if (wanted === "any" || held.value !== wanted.value || held.mask !== wanted.mask) {
        // --- Two filters, one slot: widen to match any write and let the exact test sort it out.
        filters.set(reg, "any");
      }
    }

    for (const [reg, filter] of filters) {
      if (filter === "any") continue;
      this.nextRegWatchValue[reg] = filter.value;
      // --- A zero mask is the core's "match any value", so a filter that genuinely masks nothing
      // --- must not be written as zero. It cannot be: `nextRegMask` defaults to $FF above, and a
      // --- user-supplied zero mask means "any value", which is what a zero here already says.
      this.nextRegWatchMask[reg] = filter.mask;
    }

    return this.nextRegWatch;
  }

  /**
   * Does any breakpoint want to stop on this NextReg write?
   *
   * The exact test behind the core's approximate one (`buildNextRegWatch`). Called only when the
   * core reports a hit, so it runs at most once per instruction and only while something is armed.
   *
   * @param reg The register that was written
   * @param value The value written
   * @param origin Which writer performed it
   */
  hasNextRegWrite(reg: number, value: number, origin: "cpu" | "copper"): boolean {
    let stop = false;
    for (const [key, bp] of this.breakpointDefs) {
      if (!isNextRegBreakpoint(bp) || bp.disabled) continue;
      if ((bp.nextReg! & 0xff) !== (reg & 0xff)) continue;
      // --- Copper writes are opt-in per breakpoint; a CPU write satisfies every one of them.
      if (origin === "copper" && !bp.nextRegCopper) continue;
      if (bp.nextRegValue !== undefined) {
        const mask = (bp.nextRegMask ?? 0xff) & 0xff;
        if (mask !== 0 && (((value ^ bp.nextRegValue) & mask) & 0xff) !== 0) continue;
      }
      // --- No early return: every matching definition counts its hit (C11)
      const access = { value: value & 0xff, address: reg & 0xff };
      if (this.handleHit(key, bp, "nextReg", reg & 0xff, access, false)) {
        stop = true;
      }
    }
    return stop;
  }

  /**
   * Does any enabled breakpoint watch a Copper list index (`cu:`)? Asked once per debug-loop entry
   * by the ZX Spectrum Next, like `hasNextRegBreakpoints`.
   */
  hasCopperBreakpoints(): boolean {
    for (const bp of this.breakpointDefs.values()) {
      if (isCopperBreakpoint(bp) && !bp.disabled) {
        return true;
      }
    }
    return false;
  }

  /**
   * The Copper watch table to hand the core: 128 bytes, bit `index & 7` of byte `index >> 3` set
   * for every watched list index. Rebuilt on every call, for the reason `buildNextRegWatch` gives.
   * Exact, unlike the NextReg table: a bit per index needs no collapsing.
   */
  buildCopperWatch(): Uint8Array {
    this.copperWatch.fill(0);
    for (const bp of this.breakpointDefs.values()) {
      if (!isCopperBreakpoint(bp) || bp.disabled) continue;
      const index = bp.copperIndex! & 0x3ff;
      this.copperWatch[index >> 3] |= 1 << (index & 7);
    }
    return this.copperWatch;
  }

  /**
   * Does any breakpoint want to stop on this Copper instruction? Runs every matching definition
   * through `handleHit`, so hit counts, conditions, logpoints and one-shots apply (plan D6). In a
   * condition, `ADDR` is the list index and `VAL` the instruction word.
   *
   * @param index The list index of the instruction the Copper completed
   * @param word The instruction word
   */
  hasCopperHit(index: number, word: number): boolean {
    let stop = false;
    for (const [key, bp] of this.breakpointDefs) {
      if (!isCopperBreakpoint(bp) || bp.disabled) continue;
      if ((bp.copperIndex! & 0x3ff) !== (index & 0x3ff)) continue;
      const access = { value: word & 0xffff, address: index & 0x3ff };
      if (this.handleHit(key, bp, "copper", index & 0x3ff, access, false)) {
        stop = true;
      }
    }
    return stop;
  }

  /**
   * Does any enabled breakpoint watch a sprite's attribute writes (`sp:`)? Asked once per
   * debug-loop entry by the ZX Spectrum Next, like `hasCopperBreakpoints`.
   */
  hasSpriteBreakpoints(): boolean {
    for (const bp of this.breakpointDefs.values()) {
      if (isSpriteBreakpoint(bp) && !bp.disabled) {
        return true;
      }
    }
    return false;
  }

  /**
   * The sprite watch table to hand the core: 128 bytes, byte `sprite` holding the watched attribute
   * bytes as bits 0-4. Exact, like the Copper table: every breakpoint's mask is OR-ed in, and
   * `hasSpriteHit` only has to apply the filters the core cannot (hit counts and conditions).
   */
  buildSpriteWatch(): Uint8Array {
    this.spriteWatch.fill(0);
    for (const bp of this.breakpointDefs.values()) {
      if (!isSpriteBreakpoint(bp) || bp.disabled) continue;
      this.spriteWatch[bp.spriteIndex! & 0x7f] |= spriteAttrMaskOf(bp);
    }
    return this.spriteWatch;
  }

  /**
   * Does any breakpoint want to stop on this sprite attribute write? Runs every matching definition
   * through `handleHit`, so hit counts, conditions, logpoints and one-shots apply. In a condition,
   * `ADDR` is the attribute byte (0-4) and `VAL` the value written.
   *
   * @param sprite The sprite whose attribute byte was written
   * @param attribute Which attribute byte (0-4)
   * @param value The value written
   */
  hasSpriteHit(sprite: number, attribute: number, value: number): boolean {
    let stop = false;
    for (const [key, bp] of this.breakpointDefs) {
      if (!isSpriteBreakpoint(bp) || bp.disabled) continue;
      if ((bp.spriteIndex! & 0x7f) !== (sprite & 0x7f)) continue;
      if ((spriteAttrMaskOf(bp) & (1 << attribute)) === 0) continue;
      const access = { value: value & 0xff, address: attribute & 0x07 };
      if (this.handleHit(key, bp, "sprite", sprite & 0x7f, access, false)) {
        stop = true;
      }
    }
    return stop;
  }

  /**
   * Gets I/O read breakpoint information for the specified address
   * @param address I/O address read during the current instruction
   */
  hasIoRead(address: number, value?: number): boolean {
    if (address === undefined) {
      return false;
    }
    const flags = this.breakpointFlags[address];
    if (flags & IO_READ_BP && flags & COND_BP) {
      return this.decideFiltered("ioRead", address, () => undefined, {
        value,
        address
      });
    }
    return (flags & IO_READ_BP) !== 0 && (flags & DIS_IOR_BP) === 0;
  }

  /**
   * Gets I/O write breakpoint information for the specified address
   * @param address I/O address written during the current instruction
   */
  hasIoWrite(address: number, value?: number): boolean {
    if (address === undefined) {
      return false;
    }
    const flags = this.breakpointFlags[address];
    if (flags & IO_WRITE_BP && flags & COND_BP) {
      return this.decideFiltered("ioWrite", address, () => undefined, {
        value,
        address
      });
    }
    return (flags & IO_WRITE_BP) !== 0 && (flags & DIS_IOW_BP) === 0;
  }

  /**
   * The last breakpoint we stopped in the frame
   */
  lastBreakpoint?: number;

  /**
   * Breakpoint used for step-out debugging mode
   */
  imminentBreakpoint?: number;
  sourceStep?: SourceStep;
  errorStopAddress?: number;
  romErrorAddress?: number;
  romErrorGuard?: () => boolean;
  statementTracker?: { observe(pc: number, getPartition?: (address: number) => number | undefined): void; current: number };

  /**
   * Erases all breakpoints
   */
  eraseAllBreakpoints(): void {
    this.breakpointDefs.clear();
    this.runtime.clear();
    this.storeDirty = true;
    this.breakpointFlags = new Uint16Array(0x1_0000);
    this.breakpointData.clear();
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /**
   * Adds a breakpoint to the list of existing ones
   * @param bp Breakpoint to add
   * @returns True, if a new breakpoint was added; otherwise, if an existing breakpoint was updated, false
   */
  addBreakpoint(bp: BreakpointInfo): boolean {
    // --- Store the breakpoint definition
    const bpKey = getBreakpointStorageKey(bp);
    const oldBp = this.breakpointDefs.get(bpKey);
    try {
      this.breakpointDefs.set(bpKey, {
        address: bp.address,
        partition: bp.partition,
        // --- Must be carried across: this literal rebuilds the definition field by field, so an
        // --- omitted `owner` would make every breakpoint project-owned the moment it was added,
        // --- and a project save would adopt breakpoints belonging to a `.nex` sidecar.
        owner: bp.owner,
        // --- Same reason as `owner`: this literal rebuilds the definition field by field, so a
        // --- bank-relative breakpoint would lose the very fields that make it one.
        bank: bp.bank,
        bankOffset: bp.bankOffset,
        oneShot: bp.oneShot,
        runTo: bp.runTo,
        // --- A memory range (S10) and the annotation/watch provenance (G1.5, W3): identity and
        // --- display fields, carried for the same reason as `owner` above.
        length: bp.length !== undefined && bp.length > 1 ? bp.length : undefined,
        annotationKind: bp.annotationKind,
        annotationText: bp.annotationText,
        conditionDialect: bp.conditionDialect,
        watchSymbol: bp.watchSymbol,
        resource: bp.resource,
        line: bp.line,
        // --- Part of a statement breakpoint's identity (its storage key carries it). Omitted, the
        // --- definition was stored under a key with the column while reporting none, so
        // --- `listBreakpoints` — and therefore a project save — turned it into a line breakpoint.
        column: bp.column,
        /*
         * `isNextRegBreakpoint` sits among four kind flags because a NextReg breakpoint has no kind
         * flag of its own - the register is its binding (see `BreakpointInfo.nextReg`). Without it
         * a NextReg breakpoint would be stored claiming `exec: true`, and the panel would render it
         * as an execution breakpoint with a disassembly cell it has no address to fill.
         */
        exec: !(
          bp.memoryRead ||
          bp.memoryWrite ||
          bp.ioRead ||
          bp.ioWrite ||
          isEventBreakpoint(bp)
        ),
        resolvedAddress: bp.watchSymbol
          ? (bp.resolvedAddress ?? this.watchSymbolAddress(bp.watchSymbol))
          : bp.resolvedAddress,
        resolvedPartition: bp.resolvedPartition,
        // --- Same reason as `owner` and `bank` above: this literal rebuilds the definition field
        // --- by field, so a label-anchored breakpoint would lose the label that identifies it and
        // --- the resolution that arms it. Resolution works by rewriting the whole set through
        // --- `resetBreakpointsTo`, so a dropped `resolvedBank` would be dropped on every refresh.
        label: bp.label,
        labelFile: bp.labelFile,
        resolvedBank: bp.resolvedBank,
        resolvedBankOffset: bp.resolvedBankOffset,
        memoryRead: bp.memoryRead,
        memoryWrite: bp.memoryWrite,
        ioRead: bp.ioRead,
        ioWrite: bp.ioWrite,
        ioMask: bp.ioMask ?? 0xffff,
        // --- Same reason as `owner`, `bank` and `label` above: this literal rebuilds the
        // --- definition field by field, so a NextReg breakpoint would lose the register that
        // --- identifies it and the filter that narrows it.
        nextReg: bp.nextReg,
        nextRegValue: bp.nextRegValue,
        nextRegMask: bp.nextRegMask,
        nextRegCopper: bp.nextRegCopper,
        // --- Same reason again: the Copper list index is a Copper breakpoint's whole identity.
        copperIndex: bp.copperIndex,
        // --- And the sprite, with the attribute bytes it watches.
        spriteIndex: bp.spriteIndex,
        spriteAttrMask: bp.spriteAttrMask,
        /*
         * `disabled` and `hitCount`, for the same reason as `owner` and `bank` above — and these
         * two were being dropped.
         *
         * It went unnoticed while the flags were assigned from the *incoming* breakpoint: the
         * machine behaved correctly and only the stored definition was short, so `listBreakpoints`
         * reported a breakpoint with no hit count (which is why the breakpoint dialog never showed
         * one) and `resetBreakpointsTo` had to re-apply `disabled` through `enableBreakpoint`
         * afterwards to make the definition match the flags.
         *
         * Now that `refreshFlagsAt` derives the flags *from* the definitions, an omitted `disabled`
         * would arm a breakpoint that was added disabled. The definition has to be complete.
         */
        disabled: bp.disabled,
        // --- The breakpoint's filters (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.1), normalised
        // --- so a blank condition or a mode without a count is not stored. The runtime-only fields
        // --- (`currentHits`, `conditionError`, `conditionInactive`) are deliberately absent: they
        // --- are computed when listed, never accepted from a caller.
        ...breakpointFiltersOf(bp)
      });
    } catch (err) {
      console.log("err in addBreakpoint", err.toString());
    }
    // --- Arm the condition now (C1), so a parse error is known before the first hit. The runtime
    // --- state is keyed like the definition and survives this replacement: editing a condition or
    // --- a hit rule keeps the counter (C12).
    this.runtimeFor(bpKey, this.breakpointDefs.get(bpKey)!);

    // --- A bank-relative breakpoint has no single address: it is armed at every address its bank
    // --- could be paged to, and the partition test at fire time picks the real one.
    if (isBankRelative(bp)) {
      this.armBankRelative(bp, this.collectBpFlags(bp));
      if (!this.suspendVersionIncrement) {
        this.store?.dispatch(incBreakpointsVersionAction(), "emu");
      }
      return !oldBp;
    }

    // --- Extract used address and partition (the stored definition: a watch symbol resolved there)
    const stored = this.breakpointDefs.get(bpKey)!;
    const address = stored.address ?? stored.resolvedAddress;

    // --- Do we have a breakpoint address at all?
    if (address !== undefined) {
      // --- Yes, update breakpoint flags
      const partition = bp.partition ?? bp.resolvedPartition;
      const bpFlags = this.collectBpFlags(bp);
      if (bpFlags & (IO_READ_BP | IO_WRITE_BP)) {
        // --- Update I/O breakpoints
        for (let i = 0; i < 0x1_0000; i++) {
          if ((i & (bp.ioMask ?? 0xffff)) === bp.address) {
            this.breakpointFlags[i] |= bpFlags;
          }
        }
      } else {
        // --- Derived, not assigned: the flags word belongs to every breakpoint at this address.
        // --- A memory range claims every address it covers (S10).
        if (oldBp && oldBp !== stored) {
          for (const old of this.claimedAddressesOf(oldBp)) this.refreshFlagsAt(old);
        }
        for (const claimed of this.claimedAddressesOf(stored)) this.refreshFlagsAt(claimed);
        if (partition !== undefined) {
          // --- `!== undefined`, not truthiness: partition 0 is a real partition on every banked
          // --- machine (bank `B0` on the 128K, bank `00` on the ZX Next), and a truthiness test
          // --- skipped it. `collectBpFlags` has already withheld `EXEC_BP` and set `PART_BP` for
          // --- any breakpoint carrying a partition, so leaving `partitions` empty made
          // --- `shouldStopAt` fall through to `false` — the breakpoint could never fire. Removal
          // --- (`removeBreakpoint`) and enabling (`enableBreakpoint`) both test `!== undefined`,
          // --- so this was also an add/remove asymmetry.
          // --- No tag: this entry belongs to the user's own breakpoint, not to a bank-relative
          // --- one. Dedupe is on partition *and* tag, so the two can share an address.
          for (const claimed of this.claimedAddressesOf(stored)) {
            this.addPartitionEntry(claimed, partition, undefined, !!bp.disabled);
          }
        }
      }
    }

    // --- Done, sign the change
    if (!this.suspendVersionIncrement) {
      this.store?.dispatch(incBreakpointsVersionAction(), "emu");
    }
    return !oldBp;
  }

  /**
   * Removes a breakpoint
   * @param bp Breakpoint to remove
   * @returns True, if the breakpoint has just been removed; otherwise, false
   */
  removeBreakpoint(bp: BreakpointInfo): boolean {
    // --- Remove definition
    const bpKey = getBreakpointStorageKey(bp);
    const oldBp = this.breakpointDefs.get(bpKey);
    if (!oldBp) {
      return false;
    }
    this.breakpointDefs.delete(bpKey);
    // --- A breakpoint removed and added again is a new one, and starts counting from zero
    this.runtime.delete(bpKey);
    this.storeDirty = true;

    // --- A bank-relative breakpoint owns entries at eight addresses, tagged with its key, so it
    // --- takes only its own away.
    if (isBankRelative(oldBp)) {
      this.disarmBankRelative(oldBp, this.collectBpFlags(oldBp));
      this.store?.dispatch(incBreakpointsVersionAction(), "emu");
      return true;
    }

    // --- Remove breakpoint flags
    const address = oldBp.address ?? oldBp.resolvedAddress;

    // --- Do we have a breakpoint address at all?
    if (address !== undefined) {
      // --- Yes, process it
      const partition = bp.partition ?? bp.resolvedPartition;
      // --- Derived from what is left, rather than by clearing this breakpoint's own bits: another
      // --- breakpoint at the same address may still want them. The definition has already been
      // --- deleted above, so it contributes nothing here. A range refreshes every byte it covered.
      const claimed = this.claimedAddressesOf(oldBp);
      for (const each of claimed) this.refreshFlagsAt(each);
      if (claimed.length > 1 && partition !== undefined) {
        for (const each of claimed) {
          if (each !== address) this.removeUntaggedPartitionEntryIfUnused(each, partition);
        }
      }

      if (bp.ioRead || bp.ioWrite) {
        for (let i = 0; i < 0x1_0000; i++) {
          if ((i & (bp.ioMask ?? 0xffff)) === bp.address) {
            if (bp.ioRead) {
              this.breakpointFlags[i] &= ~(IO_READ_BP | DIS_IOR_BP);
            } else {
              this.breakpointFlags[i] &= ~(IO_WRITE_BP | DIS_IOW_BP);
            }
          }
        }
      }

      if (this.breakpointData.has(address)) {
        // --- Handle the additional data
        const prevData = this.breakpointData.get(address);
        if (partition !== undefined) {
          // --- `p[2] === undefined` keeps a bank-relative breakpoint's tagged entry for the same
          // --- partition: removing one kind must not remove the other's.
          prevData.partitions = prevData.partitions.filter(
            (p) => !(p[0] === partition && p[2] === undefined)
          );
        }
        if (!prevData.partitions || prevData.partitions.length === 0) {
          // --- No more partition breakpoint for the address
          this.breakpointFlags[address] &= ~PART_BP;
          this.breakpointData.delete(address);
        }
      }
    }

    // --- Done, sign the change
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
    return true;
  }

  /**
   * Enables or disables the specified breakpoint
   * @param address Breakpoint address
   * @param enabled Is the breakpoint enabled?
   */
  enableBreakpoint(bp: BreakpointInfo, enabled: boolean): boolean {
    // --- Adjust breakpoint definition
    const bpKey = getBreakpointStorageKey(bp);
    const oldBp = this.breakpointDefs.get(bpKey);
    if (!oldBp) return false;
    oldBp.disabled = !enabled;

    // --- A bank-relative breakpoint's disabled flag lives on its own tagged entries, at each of the
    // --- eight addresses it armed.
    if (isBankRelative(oldBp)) {
      const owningKey = bpKey;
      for (const address of bankRelativeAddresses(effectiveBankSite(oldBp)!.bankOffset)) {
        const bpData = this.breakpointData.get(address);
        for (const entry of bpData?.partitions ?? []) {
          if (entry[2] === owningKey) {
            entry[1] = !enabled;
          }
        }
      }
      this.store?.dispatch(incBreakpointsVersionAction(), "emu");
      return true;
    }

    const address = oldBp.address ?? oldBp.resolvedAddress;

    // --- Do we have a breakpoint address at all?
    if (address !== undefined) {
      // --- Yes, process it
      const partition = bp.partition ?? bp.resolvedPartition;
      if (partition !== undefined) {
        // --- Enable or disable partitioned breakpoint
        const bpData = this.breakpointData.get(address);
        if (!bpData) {
          // --- Breakpoint does not exist
          return false;
        }

        // --- Get partition info. `p[2] === undefined` so that toggling a user's breakpoint does
        // --- not toggle a bank-relative one sharing the address and partition.
        const partInfo = bpData.partitions.find(
          (p) => p[0] === partition && p[2] === undefined
        );
        if (!partInfo) {
          // --- Breakpoint does not exist
          return false;
        }

        // --- Partition breakpoint found, enable or disable it (every byte of a range, S10)
        partInfo[1] = !enabled;
        for (const claimed of this.claimedAddressesOf(oldBp)) {
          if (claimed === address) continue;
          const entry = this.breakpointData
            .get(claimed)
            ?.partitions?.find((p) => p[0] === partition && p[2] === undefined);
          if (entry) entry[1] = !enabled;
        }
      } else {
        // --- Non-partition breakpoint
        let flag = 0x00;
        if (bp.exec) {
          flag = DIS_EXEC_BP;
        } else if (bp.memoryRead) {
          flag = DIS_MR_BP;
        } else if (bp.memoryWrite) {
          flag = DIS_MW_BP;
        } else if (bp.ioRead) {
          flag = DIS_IOR_BP;
        } else if (bp.ioWrite) {
          flag = DIS_IOW_BP;
        }

        if (bp.ioRead || bp.ioWrite) {
          // --- Update I/O breakpoints
          for (let i = 0; i < 0x1_0000; i++) {
            if ((i & (bp.ioMask ?? 0xffff)) === bp.address) {
              if (enabled) {
                this.breakpointFlags[i] &= ~flag;
              } else {
                this.breakpointFlags[i] |= flag;
              }
            }
          }
        } else {
          // --- Derived from the definitions (the one just changed included): a disabled flag is
          // --- set only where *every* breakpoint of the kind is disabled, over a whole range (S10).
          for (const claimed of this.claimedAddressesOf(oldBp)) this.refreshFlagsAt(claimed);
        }
      }
    }

    // --- Done, sigh the change
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
    return true;
  }

  /**
   * Scrolls down breakpoints
   * @param def Breakpoint address
   * @param lineNo Line number to shift down
   * @param lowerBound Lower bound of area to remove breakpoints from
   * @param upperBound Upper bound of area to remove breakpoints from
   */
  scrollBreakpoints(
    def: BreakpointInfo,
    shift: number,
    lowerBound?: number,
    upperBound?: number
  ): void {
    let changed = false;
    const values: BreakpointInfo[] = [];
    for (const value of this.breakpointDefs.values()) {
      values.push(value);
    }
    values.forEach((bp) => {
      if (lowerBound !== undefined && upperBound !== undefined) {
        // --- Remove breakpoints in the specified area
        if (bp.resource === def.resource && bp.line >= lowerBound && bp.line < upperBound) {
          const oldKey = getBreakpointStorageKey(bp);
          this.breakpointDefs.delete(oldKey);
          this.runtime.delete(oldKey);
          this.storeDirty = true;
          return;
        }
      }

      if (bp.resource === def.resource && bp.line >= def.line) {
        // --- Shift the breakpoint, its counter with it
        const oldKey = getBreakpointStorageKey(bp);
        this.breakpointDefs.delete(oldKey);
        bp.line += shift;
        const newKey = getBreakpointStorageKey(bp);
        this.breakpointDefs.set(newKey, bp);
        this.moveRuntime(oldKey, newKey);
        changed = true;
      }
    });
    if (changed) {
      this.store?.dispatch(incBreakpointsVersionAction(), "emu");
    }
  }

  /**
   * Normalizes source code breakpoint. Removes the ones that overflow the
   * file and also deletes duplicates.
   * @param lineCount
   * @returns
   */
  normalizeBreakpoints(resource: string, lineCount: number): void {
    const mapped = new Set<string>();
    const toDelete = new Set<string>();

    // --- Iterate through the breakpoints to find the ones to delete
    this.breakpointDefs.forEach((bp) => {
      const bpKey = getBreakpointStorageKey(bp);
      if (bp.resource === resource) {
        if (bp.line <= 0 || bp.line > lineCount) {
          // --- Delete as it overflows the file
          toDelete.add(bpKey);
        } else if (mapped.has(bpKey)) {
          // --- Deletes as it is a duplicate
          toDelete.add(bpKey);
        } else {
          // --- Map as it exists and want to avoid duplication
          mapped.add(bpKey);
        }
      }

      if (toDelete.size > 0) {
        for (const item of toDelete.values()) {
          this.breakpointDefs.delete(item);
          this.runtime.delete(item);
          this.storeDirty = true;
        }
        this.store?.dispatch(incBreakpointsVersionAction(), "emu");
      }
    });
  }

  /**
   * Resets the resolution of breakpoints
   */
  resetBreakpointResolution(): void {
    /*
     * The addresses have to be refreshed, not just the definitions cleared.
     *
     * This used to delete `resolvedAddress` and stop. The flags it had set stayed behind, so a
     * rebuild that moved a line's code — reset, then resolve to the new address — left the machine
     * stopping at the old address as well as the new one, with nothing in the Breakpoints panel to
     * explain the phantom.
     */
    const wasResolved = new Set<number>();
    for (const bp of this.breakpointDefs.values()) {
      // --- A watch-made watchpoint is resolved from the symbol table (`setConditionSymbols`), not
      // --- from the list file this reset prepares for (W3)
      if (bp.watchSymbol) continue;
      if (bp.resolvedAddress !== undefined) {
        wasResolved.add(bp.resolvedAddress);
        // --- The partition entry goes with the resolution that created it. An untagged entry at
        // --- the old address for the old partition would keep firing there after a rebuild moved
        // --- the line into a different bank.
        if (bp.resolvedPartition !== undefined) {
          this.removeUntaggedPartitionEntry(bp.resolvedAddress, bp.resolvedPartition);
        }
      }
      delete bp.resolvedAddress;
      delete bp.resolvedPartition;
    }
    for (const address of wasResolved) {
      this.refreshFlagsAt(address);
    }
  }

  /**
   * Resolves the specified resouce breakpoint to an address
   */
  resolveBreakpoint(
    resource: string,
    line: number,
    address: number,
    partition?: number,
    column?: number
  ): void {
    const spec = { resource, line, ...(column !== undefined ? { column } : {}) };
    const bpKey = getBreakpointStorageKey(spec);
    const runToKey = getBreakpointStorageKey({ ...spec, runTo: true });
    for (const key of [bpKey, runToKey]) {
      const bp = this.breakpointDefs.get(key);
      if (bp?.exec) this.resolveOne(bp, address, partition);
    }
  }

  /** Resolve one source-bound definition to `address` (see `resolveBreakpoint`). */
  private resolveOne(bp: BreakpointInfo, address: number, partition?: number): void {
    bp.resolvedAddress = address;
    bp.resolvedPartition = partition;

    /*
     * A resolved partition needs its *entry*, not just the field.
     *
     * `collectBpFlags` withholds `EXEC_BP` from anything carrying a partition and sets `PART_BP`
     * instead, and `shouldStopAt` then looks the partition up in `breakpointData`. Setting the
     * field without the entry leaves `PART_BP` with an empty list, which reads as "no breakpoint
     * here" — the breakpoint would be listed, shown in the gutter, and unable to fire. This is the
     * same trap Phase 0 documents for `addBreakpoint`'s partition path.
     */
    if (partition !== undefined) {
      this.addPartitionEntry(address, partition, undefined, !!bp.disabled);
    }

    // --- Derived: assigning `EXEC_BP` here erased the `PART_BP` of any bank-relative breakpoint
    // --- already armed at this address, which is one of the eight a single bank breakpoint takes.
    this.refreshFlagsAt(address);
  }

  /**
   * Renames breakpoints when the source file is renamed
   */
  renameBreakpoints(oldResource: string, newResource: string): void {
    const values: BreakpointInfo[] = [];
    for (const value of this.breakpointDefs.values()) {
      values.push(value);
    }
    values.forEach((bp) => {
      if (bp.resource === oldResource) {
        // --- Shift the breakpoint
        const oldKey = getBreakpointStorageKey(bp);
        this.breakpointDefs.delete(oldKey);
        bp.resource = newResource;
        const newKey = getBreakpointStorageKey(bp);
        this.breakpointDefs.set(newKey, bp);
        this.moveRuntime(oldKey, newKey);
      }
    });
  }

  /**
   * Replace the breakpoints owned by `scope`, leaving every other owner's alone.
   *
   * This used to replace the *whole* set, which is why opening a project destroyed any breakpoint
   * the project did not itself hold. The scope is a required parameter rather than an optional one
   * with an "everything" default, for the same reason `getBreakpointDisplayKey` requires its label
   * map: an omitted argument would silently restore exactly the behaviour this exists to fix.
   *
   * Breakpoints in `bps` are stamped with the owner the scope implies (`withScopeOwner`), so a
   * caller cannot install a breakpoint under one scope and have it owned by another.
   *
   * @param bps The breakpoints to install for this scope
   * @param scope Which existing breakpoints this call may remove
   */
  resetBreakpointsTo(bps: BreakpointInfo[], scope: BreakpointScope): void {
    // --- Everything this call is *not* allowed to touch, captured before the rebuild.
    const survivors = this.breakpoints.filter((bp) => !breakpointMatchesScope(bp.owner, scope));
    const installing = (bps ?? []).map((bp) => withScopeOwner(bp, scope));

    this.breakpointDefs = new Map<string, BreakpointInfo>();
    this.breakpointFlags = new Uint16Array(0x1_0000);
    this.breakpointData = new Map<number, BreakpointData>();
    this.suspendVersionIncrement = true;
    try {
      for (const bp of [...survivors, ...installing]) {
        this.addBreakpoint(bp);
        if (bp.disabled) {
          // --- `addBreakpoint` gets the *flags* right (`collectBpFlags` reads `disabled`) but
          // --- rebuilds the stored definition without carrying `disabled` across, so the breakpoint
          // --- would behave as disabled while `listBreakpoints` reported it armed. Re-applying it
          // --- here means every caller gets a faithful round trip instead of having to know this.
          this.enableBreakpoint(bp, false);
        }
      }
    } finally {
      this.suspendVersionIncrement = false;
    }
    // --- Counters survive the rebuild for every breakpoint still present (an edit keeps its count,
    // --- C12); the ones that are gone take theirs with them.
    for (const key of [...this.runtime.keys()]) {
      if (!this.breakpointDefs.has(key)) {
        this.runtime.delete(key);
        this.storeDirty = true;
      }
    }
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /**
   * The storage keys of the definitions whose filters passed - and so voted "stop" - since the last
   * stop was taken (`consumeFiredOneShots`). Recorded on the slow path (`handleHit`), which every
   * one-shot takes because it sets `COND_BP` (`collectBpFlags`).
   */
  private fired: { key: string; address: number; value?: number }[] = [];

  /**
   * The definitions that stopped the machine at the last stop, as they were then (a consumed
   * one-shot included): what the stop report names (S11). Empty when a fast-path breakpoint (no
   * filters, not a one-shot, not an annotation) stopped it, or nothing did.
   */
  lastStopBreakpoints: BreakpointInfo[] = [];

  /** For each of `lastStopBreakpoints`: the address it fired at (PC, or the accessed byte/port). */
  lastStopAccesses: { address: number; value?: number }[] = [];

  /**
   * The stop has been taken: remove exactly the one-shots among the definitions that fired for it
   * (O3, O5), and remember them all as `lastStopBreakpoints`.
   *
   * "Fired" is per definition, so a one-shot whose own condition or hit rule did not pass is not
   * spent when a *different* breakpoint stops the machine at the same address (B1, the bug of the
   * address-based `consumeOneShotsAt` this replaces). Execution, memory, I/O and NextReg stops all
   * record here, so every kind of one-shot is consumed.
   *
   * Removal goes through `removeBreakpoint`, which bumps `breakpointsVersion`: without that the
   * panel and the gutters would keep showing a breakpoint that no longer exists. A no-op (and
   * `lastStopBreakpoints` is left alone) when nothing fired, so the machine controller may call it
   * after the decision already did.
   *
   * @returns The number of one-shots removed.
   */
  consumeFiredOneShots(): number {
    if (this.fired.length === 0) return 0;
    const seen = new Set<string>();
    const hits = this.fired.filter((hit) => !seen.has(hit.key) && !!seen.add(hit.key));
    this.fired = [];
    const found = hits
      .map((hit) => ({ hit, bp: this.breakpointDefs.get(hit.key) }))
      .filter((entry): entry is { hit: (typeof hits)[number]; bp: BreakpointInfo } => !!entry.bp);
    const fired = found.map((entry) => entry.bp);
    this.lastStopBreakpoints = fired.map((bp) => ({ ...bp }));
    this.lastStopAccesses = found.map(({ hit }) => ({ address: hit.address, value: hit.value }));
    let removed = 0;
    for (const bp of fired) {
      if (bp.oneShot && this.removeBreakpoint(bp)) removed++;
    }
    return removed;
  }

  /** A run starts: nothing has fired yet, and the previous stop's report no longer applies. */
  clearFiredBreakpoints(): void {
    this.fired = [];
    this.lastStopBreakpoints = [];
    this.lastStopAccesses = [];
  }

  // ==============================================================================================
  // Conditions and hit counts (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.5)

  /**
   * The slow-path decision at an address carrying `COND_BP`: every enabled definition of `kind`
   * that claims the address, in the paged-in partition, is evaluated and counted, and the machine
   * stops if any of them says so. Evaluating all of them keeps each counter right (C11).
   */
  private decideFiltered(
    kind: DecisionKind,
    address: number,
    partitionResolver: (address: number) => number | undefined,
    access?: AccessFacts
  ): boolean {
    let stop = false;
    let resolved = false;
    let paged: number | undefined;
    for (const [key, bp] of this.breakpointDefs) {
      if (bp.disabled || !kindMatches(bp, kind) || !this.claimsAddress(bp, address)) continue;
      const site = effectiveBankSite(bp);
      const partition = site
        ? bankRelativePartition(site.bank, site.bankOffset)
        : (bp.partition ?? bp.resolvedPartition);
      if (partition !== undefined) {
        if (!resolved) {
          paged = partitionResolver(address);
          resolved = true;
        }
        if (paged !== partition) continue;
      }
      if (this.handleHit(key, bp, accessKindOf(kind), address, access, kind === "exec")) {
        stop = true;
      }
    }
    return stop;
  }

  /**
   * One definition reached: a breakpoint votes "stop" if its filters pass; a logpoint
   * (`.plans/LOGPOINTS_PLAN.md` §4.2) logs if they pass and never stops (L3).
   *
   * A logpoint whose group is switched off, that is inactive (a missing label, C14), or - at an
   * execution address - that is not being *arrived at* (L5), is skipped before its filters run, so
   * it neither logs nor counts.
   */
  private handleHit(
    key: string,
    bp: BreakpointInfo,
    accessKind: ConditionAccessKind,
    address: number,
    access: AccessFacts | undefined,
    isExec: boolean
  ): boolean {
    if (!isLogpoint(bp)) {
      if (!this.passesFilters(key, bp, accessKind, access)) return false;
      // --- This definition votes "stop": the one-shot consumption and the stop report read it
      this.fired.push({ key, address: address & 0xffff, value: access?.value });
      return true;
    }

    if (isExec && !this.logArrival) return false;
    const state = this.runtimeFor(key, bp, accessKind);
    if (!this.isLogGroupEnabled(state.template?.group ?? logGroupOf(bp.logMessage))) return false;
    if (state.template?.inactiveReason) return false;
    if (this.passesFilters(key, bp, accessKind, access)) {
      this.queueLog(key, state, address, access);
    }
    return false;
  }

  /** Fill in a logpoint's template now - the values must be the ones at the hit (L8) - and queue it. */
  private queueLog(
    key: string,
    state: BreakpointRuntimeState,
    address: number,
    access: AccessFacts | undefined
  ): void {
    if (this.pendingLog.length >= LOG_LINES_PER_FRAME) {
      this.droppedLogLines++;
      return;
    }
    const template = state.template;
    const text = template
      ? this.renderTemplateNow(state, access)
      : `<logpoint error: ${state.logError ?? "the template did not compile"}>`;
    this.pendingLog.push({
      group: template?.group ?? DEFAULT_GROUP,
      text,
      address: address & 0xffff,
      key
    });
  }

  /** A compiled template's text, its values read from the machine now. */
  private renderTemplateNow(state: BreakpointRuntimeState, access: AccessFacts | undefined): string {
    const template = state.template!;
    const store = this.syncConditionStore();
    if (store && template.segments.some((s) => s.k === "value" && s.usesEnv)) {
      this.writeConditionEnv(store);
    }
    return renderLogTemplate(
      template,
      (index): LogValue => {
        const slot = state.templateSlots?.[index];
        if (!store || slot === undefined) return { status: "error" };
        const { status, value } = store.evaluateValue(slot, access?.value ?? 0, access?.address ?? 0);
        if (status === ConditionResult.DIVZERO) return { status: "divZero" };
        if (status === ConditionResult.ERROR) return { status: "error" };
        if (value === NO_VALUE) return { status: "noValue" };
        return { status: "ok", value };
      },
      {
        peek: (a) => store?.peek(a) ?? 0,
        slots: () => this.machineInfo?.slots() ?? ""
      }
    );
  }

  /**
   * The values a DeZog expression reads, as the machine holds them now - `A=$07, b@(HL)=$12` - for
   * an `ASSERTION`'s failure report (S11, DeZog's "ASSERTIONs show the failure values"). Every
   * register and memory read the expression names, each once, in the order written; labels are
   * constants and are left out. Empty when there is nothing to show or the machine cannot say.
   */
  describeDezogValues(text: string): string {
    let tree: SyntaxNode;
    try {
      tree = parseDezogExpression(text);
    } catch {
      return "";
    }
    const terms: string[] = [];
    const visit = (node: SyntaxNode) => {
      switch (node.k) {
        case "name":
          if (!node.quoted) terms.push(text.substring(node.start, node.end));
          return;
        case "mem":
          terms.push(text.substring(node.start, node.end));
          return;
        case "un":
          visit(node.e);
          return;
        case "bin":
          visit(node.l);
          visit(node.r);
          return;
        case "call":
          visit(node.arg);
          return;
      }
    };
    visit(tree);
    const unique = [...new Set(terms.map((t) => t.replace(/\s+/g, "")))];
    if (!unique.length) return "";
    const template = unique.map((t) => `${t}=\${${t}}`).join(", ");
    const compiled = compileLogTemplate(template, "dezog", {
      ...this.conditionFacts,
      accessKind: "exec",
      symbols: this.conditionSymbols
    });
    if (!compiled.template || !this.conditionStoreProvider?.()) return "";
    // --- A transient runtime entry, so the store places its programs; gone again afterwards
    const key = "\u0000report";
    const state: BreakpointRuntimeState = { hits: 0, template: compiled.template };
    this.runtime.set(key, state);
    this.storeDirty = true;
    try {
      return this.renderTemplateNow(state, undefined);
    } finally {
      this.runtime.delete(key);
      this.storeDirty = true;
    }
  }

  /** Write the facts `cpufreq()` and `frame()` read into the core before a program reads them. */
  private writeConditionEnv(store: ConditionStore): void {
    const info = this.machineInfo;
    store.setEnv(CondEnv.CPUFREQ, info?.cpuFrequency() ?? 0);
    store.setEnv(CondEnv.FRAME, info?.frame() ?? 0);
  }

  /**
   * The log lines queued since the last call, and how many were dropped for the cap (L9). The
   * machine controller drains this once per frame and before it reports a stop (L4, L8).
   */
  takeLogLines(): { lines: LogLine[]; dropped: number } {
    const lines = this.pendingLog;
    const dropped = this.droppedLogLines;
    this.pendingLog = [];
    this.droppedLogLines = 0;
    return { lines, dropped };
  }

  /** Are log lines waiting? Cheap: the controller asks after every frame. */
  get hasPendingLog(): boolean {
    return this.pendingLog.length > 0 || this.droppedLogLines > 0;
  }

  /**
   * Switch logpoint groups (the DeZog model, §4.2): all on, all off, or only the listed groups on.
   * Group state is separate from each logpoint's own `disabled` flag; a logpoint logs only if both
   * allow it (L11).
   */
  setLogGroups(state: LogpointGroupState | undefined): void {
    this.logGroups = normaliseLogGroups(state);
    this.store?.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /** The group switch now: what `setLogGroups` set, or the shared store's when it changed since. */
  get logGroupState(): LogpointGroupState {
    const fromStore = this.store?.getState()?.logpointGroups;
    if (fromStore && fromStore !== this.logGroupsFromStore) {
      this.logGroupsFromStore = fromStore;
      this.logGroups = normaliseLogGroups(fromStore);
    }
    return this.logGroups;
  }

  /** Does this group log? */
  isLogGroupEnabled(group: string): boolean {
    const state = this.logGroupState;
    if (!state.enabled) return false;
    return !state.groups || state.groups.includes(group.toUpperCase());
  }

  /**
   * One definition's hit: evaluate its condition, count the hit if true, apply the hit rule.
   *
   * - A condition that did not compile counts as true (C15, fail-safe).
   * - An inactive condition (a missing label, C14) neither stops nor counts.
   * - A condition the core cannot run - no evaluator, no room in its store, an error from the
   *   evaluator - counts as true, for the same reason as C15.
   *
   * The evaluation itself is one call into the core (`condEvaluate`), which reads the registers and
   * memory where they live.
   */
  private passesFilters(
    key: string,
    bp: BreakpointInfo,
    accessKind: ConditionAccessKind,
    access?: AccessFacts
  ): boolean {
    const state = this.runtimeFor(key, bp, accessKind);
    if (state.compiled) {
      if (state.compiled.inactiveReason) return false;
      const store = this.syncConditionStore();
      if (store && state.slot !== undefined) {
        if (state.conditionUsesEnv) this.writeConditionEnv(store);
        const result = store.evaluate(state.slot, access?.value ?? 0, access?.address ?? 0);
        if (result === ConditionResult.FALSE) return false;
      }
    }

    state.hits++;
    this.hitsChanged = true;
    this.onHitCounted?.(key);
    const mode = effectiveHitMode(bp);
    if (!mode) return true;
    const target = bp.hitCount!;
    switch (mode) {
      case "eq":
        return state.hits === target;
      case "gt":
        return state.hits > target;
      case "ge":
        return state.hits >= target;
      case "lt":
        return state.hits < target;
      case "le":
        return state.hits <= target;
      case "every":
        return state.hits % target === 0;
    }
  }

  /**
   * The runtime state of one definition, with its condition compiled for the current machine facts
   * and bound to the current symbols. Recompiles only when the text, the kind or the facts changed.
   */
  private runtimeFor(
    key: string,
    bp: BreakpointInfo,
    accessKind: ConditionAccessKind = accessKindOfBreakpoint(bp)
  ): BreakpointRuntimeState {
    let state = this.runtime.get(key);
    if (!state) {
      state = { hits: 0 };
      this.runtime.set(key, state);
    }
    const text = bp.condition?.trim() ? bp.condition : undefined;
    const conditionDialect = bp.conditionDialect ?? "klive";
    if (
      state.compiledFor !== text ||
      state.compiledDialect !== conditionDialect ||
      state.compiledKind !== accessKind ||
      state.compiledStamp !== this.conditionStamp
    ) {
      state.compiledFor = text;
      state.compiledDialect = conditionDialect;
      state.compiledKind = accessKind;
      state.compiledStamp = this.conditionStamp;
      state.compiled = undefined;
      state.error = undefined;
      this.storeDirty = true;
      if (text !== undefined) {
        const env = { ...this.conditionFacts, accessKind, symbols: this.conditionSymbols };
        // --- An `ASSERTION` comment's expression is DeZog's (S4): its own parser, the one checker
        const result =
          conditionDialect === "dezog"
            ? compileConditionWith(text, env, parseDezogExpression)
            : compileCondition(text, env);
        if (result.compiled) {
          state.compiled = result.compiled;
          state.conditionUsesEnv = usesConditionEnv(result.compiled.tree);
        } else {
          const first = result.errors[0];
          state.error = `column ${first.start + 1}: ${first.message}`;
        }
      }
    }

    // --- A logpoint's template, compiled the same way (`.plans/LOGPOINTS_PLAN.md` §4.2)
    const template = bp.logMessage || undefined;
    const dialect = effectiveLogDialect(bp);
    if (
      state.templateFor !== template ||
      state.templateDialect !== dialect ||
      state.templateKind !== accessKind ||
      state.templateStamp !== this.conditionStamp
    ) {
      state.templateFor = template;
      state.templateDialect = dialect;
      state.templateKind = accessKind;
      state.templateStamp = this.conditionStamp;
      state.template = undefined;
      state.logError = undefined;
      state.templateSlots = undefined;
      this.storeDirty = true;
      if (template !== undefined) {
        const result = compileLogTemplate(template, dialect, {
          ...this.conditionFacts,
          accessKind,
          symbols: this.conditionSymbols
        });
        if (result.template) {
          state.template = result.template;
        } else {
          const first = result.errors[0];
          state.logError = `column ${first.start + 1}: ${first.message}`;
        }
      }
    }
    return state;
  }

  /**
   * The core's program store, rebuilt when it is stale: every active condition's program written
   * into its own slot (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` §4.4). Rebuilt whole rather than
   * patched - the store is a cache of the definitions, and a cache patched in place is the kind of
   * thing this file has learned not to trust (R5). Stale means a program changed since the last
   * build, or the store does not carry the last build's token: a core instantiated since then has
   * an empty store.
   */
  private syncConditionStore(): ConditionStore | undefined {
    const store = this.conditionStoreProvider?.();
    if (!store) return undefined;
    if (!this.storeDirty && this.storeToken !== 0 && store.token === this.storeToken) return store;

    store.slots.fill(0);
    let slot = 0;
    let offset = 0;
    // --- One program into the next free slot; `undefined` when the store has no room
    const place = (code: Uint32Array): number | undefined => {
      if (
        slot >= store.slotCount ||
        code.length > store.maxProgramWords ||
        offset + code.length > store.arena.length
      ) {
        return undefined;
      }
      store.arena.set(code, offset);
      store.slots[slot * 2] = offset;
      store.slots[slot * 2 + 1] = code.length;
      offset += code.length;
      return slot++;
    };
    for (const state of this.runtime.values()) {
      state.slot = undefined;
      state.overflow = false;
      if (state.compiled && !state.compiled.inactiveReason) {
        state.slot = place(emitCondition(state.compiled));
        state.overflow = state.slot === undefined;
      }

      // --- Every value placeholder of a logpoint is a program of its own
      state.templateSlots = undefined;
      state.logOverflow = false;
      if (state.template && !state.template.inactiveReason) {
        state.templateSlots = state.template.segments.map((segment) => {
          if (segment.k !== "value") return undefined;
          const placed = place(emitCondition(segment.compiled));
          if (placed === undefined) state.logOverflow = true;
          return placed;
        });
      }
    }
    this.storeToken = (this.storeToken % 0xfffffffe) + 1;
    store.token = this.storeToken;
    this.storeDirty = false;
    return store;
  }

  /**
   * The machine facts conditions compile against (§3.7 rules 3-5). Every compiled condition is
   * rebuilt on its next use, so a condition that failed against the wrong facts gets another go.
   */
  setConditionEnvironment(facts: ConditionMachineFacts): void {
    this.conditionFacts = facts;
    this.conditionStamp++;
  }

  /**
   * Replace the program symbols conditions bind their labels to (§3.6). Called after every build
   * and when a project opens; every compiled condition is re-bound, so a label a build just defined
   * brings its breakpoint back to life (C14).
   */
  /** The symbols conditions are bound to now. */
  get conditionSymbolTable(): ConditionSymbols {
    return this.conditionSymbols;
  }

  setConditionSymbols(symbols: ConditionSymbols): void {
    this.conditionSymbols = symbols ?? {};
    let changed = false;
    for (const state of this.runtime.values()) {
      if (!state.compiled) continue;
      const before = state.compiled.inactiveReason;
      bindCondition(state.compiled, this.conditionSymbols);
      // --- A label's value is a constant in the program, so every program is re-emitted
      this.storeDirty = true;
      changed ||= before !== state.compiled.inactiveReason;
    }
    for (const state of this.runtime.values()) {
      if (!state.template) continue;
      const before = state.template.inactiveReason;
      bindLogTemplate(state.template, this.conditionSymbols);
      this.storeDirty = true;
      changed ||= before !== state.template.inactiveReason;
    }
    if (this.resolveWatchSymbols()) changed = true;
    // --- Only when a breakpoint went inactive or came back: the editors and the panel show that,
    // --- while a rebuild that moved nothing should not ripple through every breakpoint listener.
    if (changed) this.store?.dispatch(incBreakpointsVersionAction(), "emu");
  }

  /**
   * Zero one breakpoint's hit counter, or every counter (C12). Called on a machine restart and by
   * the explicit reset commands.
   * @param bp The breakpoint whose counter to reset; all of them when absent
   * @returns False when `bp` names no breakpoint
   */
  resetHitCounts(bp?: BreakpointInfo): boolean {
    if (bp) {
      const key = getBreakpointStorageKey(bp);
      if (!this.breakpointDefs.has(key)) return false;
      const state = this.runtime.get(key);
      if (state) state.hits = 0;
    } else {
      for (const state of this.runtime.values()) state.hits = 0;
    }
    this.store?.dispatch(incBreakpointHitsVersionAction(), "emu");
    return true;
  }

  /**
   * Did a hit counter move since the last call? Consumed by the machine controller, which turns it
   * into a throttled `incBreakpointHitsVersionAction` - counting itself never dispatches, or a hot
   * loop would flood the store.
   */
  takeHitsChanged(): boolean {
    const changed = this.hitsChanged;
    this.hitsChanged = false;
    return changed;
  }

  /**
   * The breakpoints that would stop at an execution address in the past
   * (`.plans/LITE_STEP_BACK_PLAN.md` D11): Reverse Continue's search. Enabled execution breakpoints
   * claiming the address in the partition the record was made in, with their compiled conditions for
   * the caller to evaluate against the record's registers. Hit counts are ignored, logpoints neither
   * stop nor print, and a condition waiting for a missing label does not stop - as live.
   */
  historicalExecBreakpoints(
    address: number,
    partition: number | undefined
  ): { bp: BreakpointInfo; compiled?: CompiledCondition; error?: string }[] {
    const found: { bp: BreakpointInfo; compiled?: CompiledCondition; error?: string }[] = [];
    for (const [key, bp] of this.breakpointDefs) {
      // --- ASSERTION and WPMEM comments are checks, not stops a user placed to come back to
      if (bp.disabled || !bp.exec || bp.runTo || bp.annotationKind || isLogpoint(bp)) continue;
      if (!this.claimsAddress(bp, address)) continue;
      const site = effectiveBankSite(bp);
      const own = site ? bankRelativePartition(site.bank, site.bankOffset) : (bp.partition ?? bp.resolvedPartition);
      if (own !== undefined && own !== partition) continue;
      const state = this.runtimeFor(key, bp, "exec");
      if (state.compiled?.inactiveReason) continue;
      found.push({ bp, ...(state.compiled ? { compiled: state.compiled } : {}), ...(state.error ? { error: state.error } : {}) });
    }
    return found;
  }

  /**
   * The breakpoints with their runtime state: the live hit count, a condition error, the reason a
   * condition is inactive. What `listBreakpoints` reports; every persister strips these fields.
   */
  listBreakpointsWithState(): BreakpointInfo[] {
    const result: BreakpointInfo[] = [];
    for (const [key, bp] of this.breakpointDefs) {
      const listed: BreakpointInfo = { ...bp };
      const state = this.runtimeFor(key, bp);
      // --- Built now, so a condition the store has no room for reports it before its first hit
      if (
        (state.compiled && !state.compiled.inactiveReason) ||
        (state.template && !state.template.inactiveReason)
      ) {
        this.syncConditionStore();
      }
      if (state.overflow) {
        listed.conditionError =
          "the machine's condition store is full - it stops every time; remove some conditions";
      }
      if (hasBreakpointFilters(bp) || isLogpoint(bp) || state.hits > 0) {
        listed.currentHits = state.hits;
      }
      if (state.error) listed.conditionError ??= state.error;
      if (state.compiled?.inactiveReason) listed.conditionInactive = state.compiled.inactiveReason;
      else if (state.template?.inactiveReason) {
        listed.conditionInactive = state.template.inactiveReason;
      }
      if (bp.watchSymbol && bp.resolvedAddress === undefined) {
        listed.conditionInactive ??= `unknown symbol ${bp.watchSymbol}`;
      }
      if (state.logError) listed.logError = state.logError;
      else if (state.logOverflow) {
        listed.logError =
          "the machine's condition store is full - placeholders print <error>; remove some conditions";
      }
      result.push(listed);
    }
    return result;
  }

  /** Keep a definition's counter when its key changes under it (a line moved, a file renamed). */
  private moveRuntime(oldKey: string, newKey: string): void {
    if (oldKey === newKey) return;
    const state = this.runtime.get(oldKey);
    this.runtime.delete(oldKey);
    this.storeDirty = true;
    if (state) this.runtime.set(newKey, state);
  }

  /**
   * The execution/access kinds a single address can carry, each with its "disabled" marker.
   *
   * Paired, because a kind is only disabled when *every* breakpoint providing it is: two
   * breakpoints at one address, one disabled, must leave the address armed.
   */
  private static readonly FLAG_KINDS: readonly (readonly [number, number])[] = [
    [EXEC_BP, DIS_EXEC_BP],
    [MEM_READ_BP, DIS_MR_BP],
    [MEM_WRITE_BP, DIS_MW_BP],
    [IO_READ_BP, DIS_IOR_BP],
    [IO_WRITE_BP, DIS_IOW_BP]
  ];

  /**
   * Rebuild one address's flags from the breakpoint definitions.
   *
   * **The single authority on what `breakpointFlags[address]` should be**, replacing three places
   * that each mutated it in their own way — and each got it wrong, in ways proved by the tests in
   * `test/debug/BreakpointFlagIntegrity.test.ts`:
   *
   * - `addBreakpoint` **assigned** (`= bpFlags`), so adding a plain breakpoint at an address a
   *   bank-relative one had armed erased its `PART_BP`. The address still stopped the machine while
   *   the new breakpoint was there, and stopped stopping for good once it was removed.
   * - `resolveBreakpoint` assigned too, so a source breakpoint resolving onto a bank breakpoint's
   *   address silently disarmed it.
   * - `resetBreakpointResolution` deleted `resolvedAddress` from the definitions and left the flags
   *   behind, so a rebuild that moved a line's code left the machine stopping at **both** the old
   *   address and the new one.
   * - `removeBreakpoint` cleared its own bits (`&= ~bpFlags | PART_BP`), which also cleared them
   *   for any *other* breakpoint at the same address that still wanted them.
   *
   * The common cause is that a flags word is shared by every breakpoint at an address while each
   * site treated it as its own. Deriving it is the only approach where that cannot be got wrong:
   * the definitions are the truth, `collectBpFlags` already says what one breakpoint contributes,
   * and this ORs them.
   *
   * I/O breakpoints are included — they claim every address their port mask matches — so an address
   * that is both a port and a code address comes out right. The *bulk* I/O paths stay as they are:
   * they touch up to 65536 addresses, and recomputing each from every definition would turn setting
   * one masked port breakpoint into a quadratic scan.
   */
  private refreshFlagsAt(address: number): void {
    let extra = 0; // --- PART_BP / HIT_BP / COND_BP: not kinds, and not separately disable-able
    let present = 0; // --- kinds any breakpoint here provides
    let armed = 0; // --- kinds at least one *enabled* breakpoint here provides

    for (const bp of this.breakpointDefs.values()) {
      if (!this.claimsAddress(bp, address)) continue;

      const bpFlags = this.collectBpFlags(bp);
      extra |= bpFlags & (PART_BP | HIT_BP | COND_BP);
      for (const [kind] of DebugSupport.FLAG_KINDS) {
        if (!(bpFlags & kind)) continue;
        present |= kind;
        if (!bp.disabled) armed |= kind;
      }
    }

    let flags = extra | present;
    for (const [kind, disabledBit] of DebugSupport.FLAG_KINDS) {
      if (present & kind && !(armed & kind)) flags |= disabledBit;
    }
    this.breakpointFlags[address] = flags;
  }

  /** Does this breakpoint put flags on `address`? */
  private claimsAddress(bp: BreakpointInfo, address: number): boolean {
    if (bp.ioRead || bp.ioWrite) {
      // --- A port breakpoint claims every address the mask leaves matching its port.
      return (address & (bp.ioMask ?? 0xffff)) === bp.address;
    }
    const site = effectiveBankSite(bp);
    if (site) {
      // --- All eight addresses its bank could be paged to, the same ones `armBankRelative` set.
      return bankRelativeAddresses(site.bankOffset).includes(address);
    }
    const start = bp.address ?? bp.resolvedAddress;
    if (start === undefined) return false;
    if ((bp.memoryRead || bp.memoryWrite) && bp.length !== undefined && bp.length > 1) {
      return address >= start && address < start + bp.length;
    }
    return start === address;
  }

  /**
   * The addresses a plain (not bank-relative, not I/O) definition puts flags on: its address, or
   * every byte of a memory range (S10). A range never wraps past `$FFFF`.
   */
  private claimedAddressesOf(bp: BreakpointInfo): number[] {
    const start = bp.address ?? bp.resolvedAddress;
    if (start === undefined) return [];
    if (!(bp.memoryRead || bp.memoryWrite) || bp.length === undefined || bp.length <= 1) {
      return [start];
    }
    const end = Math.min(0x1_0000, start + bp.length);
    const result: number[] = [];
    for (let a = start; a < end; a++) result.push(a);
    return result;
  }

  /** Drop the untagged partition entry at `address` unless a remaining definition still claims it. */
  private removeUntaggedPartitionEntryIfUnused(address: number, partition: number): void {
    for (const bp of this.breakpointDefs.values()) {
      if ((bp.partition ?? bp.resolvedPartition) === partition && this.claimsAddress(bp, address)) {
        return;
      }
    }
    this.removeUntaggedPartitionEntry(address, partition);
  }

  /** The address a watch symbol resolves to now (W3), `undefined` while the build lacks it. */
  private watchSymbolAddress(symbol: string): number | undefined {
    const value = this.conditionSymbols[symbol.toLowerCase()];
    return value === undefined ? undefined : value & 0xffff;
  }

  /**
   * Re-resolve every watch-made watchpoint against the current symbol table (W3): a rebuild that
   * moved its label moves the watched bytes, and a symbol the build no longer has leaves it
   * inactive (no address, so no flags).
   * @returns Whether any watchpoint moved
   */
  private resolveWatchSymbols(): boolean {
    let changed = false;
    for (const bp of [...this.breakpointDefs.values()]) {
      if (!bp.watchSymbol) continue;
      const next = this.watchSymbolAddress(bp.watchSymbol);
      if (next === bp.resolvedAddress) continue;
      const before = this.claimedAddressesOf(bp);
      bp.resolvedAddress = next;
      for (const address of before) this.refreshFlagsAt(address);
      for (const address of this.claimedAddressesOf(bp)) this.refreshFlagsAt(address);
      changed = true;
    }
    return changed;
  }

  /**
   * Is a **session-owned** breakpoint armed at `address`?
   *
   * Derived from the definitions rather than cached: a cache would have to be invalidated at every
   * one of the eleven places the definitions change, including `enableBreakpoint` and the resource
   * renames, and a missed one fails in the worst possible direction — a breakpoint that silently
   * stops mattering. The scan is affordable because it runs only while `suppressUserBreakpoints`
   * is set (the few seconds of a launch flow) *and* only at an address whose flags already say a
   * breakpoint is there.
   *
   * The address test mirrors how each shape was armed: a bank-relative breakpoint occupies all
   * eight addresses its bank could be paged to, so any of them counts. The bank itself is not
   * checked here — `shouldStopAt` goes on to do the partition test for real, and this predicate
   * only decides whether it is allowed to.
   */
  private hasSessionStopAt(address: number): boolean {
    for (const bp of this.breakpointDefs.values()) {
      if (bp.owner?.kind !== "session" || bp.disabled) continue;
      const site = effectiveBankSite(bp);
      if (site) {
        if (bankRelativeAddresses(site.bankOffset).includes(address)) return true;
        continue;
      }
      if ((bp.address ?? bp.resolvedAddress) === address) return true;
    }
    return false;
  }

  /**
   * Record that `partition` has a breakpoint at `address`, tagged with its provenance.
   *
   * Deduplicates on partition *and* tag, so a bank-relative breakpoint and a user's own
   * partition-scoped one can coexist at the same address and partition, and each can be removed
   * without disturbing the other.
   */
  private addPartitionEntry(
    address: number,
    partition: number,
    owningKey?: string,
    disabled = false
  ): void {
    let bpData = this.breakpointData.get(address);
    if (!bpData) {
      bpData = {};
      this.breakpointData.set(address, bpData);
    }
    bpData.partitions ??= [];
    if (!bpData.partitions.some((p) => p[0] === partition && p[2] === owningKey)) {
      // --- `disabled` was hardcoded `false` here, so a partition-scoped or bank-relative
      // --- breakpoint *added* disabled came out armed. Every caller happened to work around it by
      // --- calling `enableBreakpoint` afterwards — `applyBreakpointEdit` and `resetBreakpointsTo`
      // --- both do, and both say in a comment that they have to — so the flags and the definition
      // --- only agreed by way of a second call that could be forgotten.
      bpData.partitions.push([partition, disabled, owningKey]);
    }
  }

  /**
   * Drop the untagged partition entry for `partition` at `address`.
   *
   * Untagged only: a tagged entry belongs to a bank-relative breakpoint, which owns its own
   * lifetime through `disarmBankRelative`. The two can share an address *and* a partition, so
   * matching on the partition alone would disarm someone else's breakpoint.
   */
  private removeUntaggedPartitionEntry(address: number, partition: number): void {
    const bpData = this.breakpointData.get(address);
    if (!bpData?.partitions) return;

    bpData.partitions = bpData.partitions.filter(
      (p) => !(p[0] === partition && p[2] === undefined)
    );
    if (bpData.partitions.length === 0) {
      this.breakpointData.delete(address);
    }
  }

  /**
   * Arm a bank-relative breakpoint: the same flags at all eight addresses its bank could appear at,
   * each carrying the 8K partition the bank's offset resolves to.
   *
   * Flags are OR-ed rather than assigned, so arming one breakpoint cannot clear another's at a
   * shared address.
   */
  private armBankRelative(bp: BreakpointInfo, bpFlags: number): void {
    // --- The *effective* site: stated by the breakpoint, or filled in by resolution for a
    // --- label-anchored one. The arming cannot tell the difference, and must not.
    const site = effectiveBankSite(bp)!;
    const partition = bankRelativePartition(site.bank, site.bankOffset);
    const owningKey = getBreakpointStorageKey(bp);
    for (const address of bankRelativeAddresses(site.bankOffset)) {
      this.breakpointFlags[address] |= bpFlags;
      this.addPartitionEntry(address, partition, owningKey, !!bp.disabled);
    }
  }

  /** Drop a bank-relative breakpoint's own entries and flags from all eight of its addresses. */
  private disarmBankRelative(bp: BreakpointInfo, bpFlags: number): void {
    const owningKey = getBreakpointStorageKey(bp);
    for (const address of bankRelativeAddresses(effectiveBankSite(bp)!.bankOffset)) {
      const bpData = this.breakpointData.get(address);
      if (bpData?.partitions) {
        bpData.partitions = bpData.partitions.filter((p) => p[2] !== owningKey);
        if (bpData.partitions.length === 0) {
          this.breakpointFlags[address] &= ~(bpFlags | PART_BP);
          this.breakpointData.delete(address);
        }
      }
    }
  }

  // --- Get the breakpoint flags from the definition
  private collectBpFlags(bp: BreakpointInfo): number {
    // --- Collect breakpoint flags
    let bpFlags = 0x00;
    // --- `EXEC_BP` means "fires whatever is paged in here", so it must be withheld from any
    // --- breakpoint that carries a partition — a bank-relative one included, whose partition is
    // --- derived from its bank and offset rather than stated.
    const bankRelative = isBankRelative(bp);
    if (
      bp.exec &&
      !bankRelative &&
      bp.partition === undefined &&
      bp.resolvedPartition === undefined
    ) {
      bpFlags |= EXEC_BP;
      if (bp.disabled) {
        bpFlags |= DIS_EXEC_BP;
      }
    }
    /*
     * `resolvedPartition` counts, not just `partition`.
     *
     * The test above already withholds `EXEC_BP` for a resolved partition, but this one did not
     * grant `PART_BP` for it — so a breakpoint carrying only a *resolved* partition came out with
     * no execution flag of either kind and could never fire. It went unnoticed because
     * `resolvedPartition` was read in five places and written in none until source breakpoints
     * started carrying their `.bank`'s partition (§13.4); `resolveBreakpoint` hardcoded `EXEC_BP`
     * and so never consulted this.
     */
    if (bp.partition !== undefined || bp.resolvedPartition !== undefined || bankRelative) {
      bpFlags |= PART_BP;
    }
    if (bp.memoryRead) {
      bpFlags |= MEM_READ_BP;
      if (bp.disabled) {
        bpFlags |= DIS_MR_BP;
      }
    }
    if (bp.memoryWrite) {
      bpFlags |= MEM_WRITE_BP;
      if (bp.disabled) {
        bpFlags |= DIS_MW_BP;
      }
    }
    if (bp.ioRead) {
      bpFlags |= IO_READ_BP;
      if (bp.disabled) {
        bpFlags |= DIS_IOR_BP;
      }
    }
    if (bp.ioWrite) {
      bpFlags |= IO_WRITE_BP;
      if (bp.disabled) {
        bpFlags |= DIS_IOW_BP;
      }
    }
    if (bp.hitCount !== undefined) {
      bpFlags |= HIT_BP;
    }
    // --- A one-shot takes the slow path too: only there is the definition that fired known, and
    // --- only that definition may be consumed (O3). Annotation breakpoints are named in the stop
    // --- report (S11), which needs the same knowledge.
    if (hasBreakpointFilters(bp) || isLogpoint(bp) || bp.oneShot || bp.owner?.kind === "annotation") {
      bpFlags |= COND_BP;
    }

    return bpFlags;
  }
}

// --- Extra data assigned to a particular breakpoint
type BreakpointData = {
  /**
   * The partitions with a breakpoint at this address: `[partition, disabled, owningKey?]`.
   *
   * Positions 0 and 1 are unchanged, which is what keeps the per-instruction test in `shouldStopAt`
   * — `partitions.find((p) => p[0] === partition)` and `p[1]` — untouched.
   *
   * The third element is the storage key of the **bank-relative** breakpoint that contributed the
   * entry, and is absent for a user's own `bp-set <partition>:<address>`. It exists because one
   * bank-relative breakpoint arms eight addresses, and at any of them a user breakpoint may already
   * claim the same partition; without the tag, removing one would remove the other's entry too.
   */
  partitions?: [number, boolean, string?][];
};

/** Does a definition watch this kind of access? */
function kindMatches(bp: BreakpointInfo, kind: DecisionKind): boolean {
  switch (kind) {
    case "exec":
      return !!bp.exec;
    case "memRead":
      return !!bp.memoryRead;
    case "memWrite":
      return !!bp.memoryWrite;
    case "ioRead":
      return !!bp.ioRead;
    case "ioWrite":
      return !!bp.ioWrite;
  }
}

/** The condition-language kind of a decision. */
function accessKindOf(kind: DecisionKind): ConditionAccessKind {
  return kind === "exec" ? "exec" : kind === "memRead" || kind === "memWrite" ? "memory" : "io";
}

/** The condition-language kind of a breakpoint definition. */
function accessKindOfBreakpoint(bp: BreakpointInfo): ConditionAccessKind {
  if (isNextRegBreakpoint(bp)) return "nextReg";
  if (isCopperBreakpoint(bp)) return "copper";
  if (isSpriteBreakpoint(bp)) return "sprite";
  if (bp.memoryRead || bp.memoryWrite) return "memory";
  if (bp.ioRead || bp.ioWrite) return "io";
  return "exec";
}

/** The group of a logpoint whose template could not be read. */
const DEFAULT_GROUP = "DEFAULT";

/** Group names upper-case and de-duplicated; a missing state is "everything on". */
function normaliseLogGroups(state: LogpointGroupState | undefined): LogpointGroupState {
  if (!state) return { enabled: true };
  return state.enabled && state.groups
    ? { enabled: true, groups: [...new Set(state.groups.map((g) => g.toUpperCase()))] }
    : { enabled: !!state.enabled };
}

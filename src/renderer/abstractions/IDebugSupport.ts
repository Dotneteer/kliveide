import type {
  BreakpointInfo,
  BreakpointScope,
  LogpointGroupState
} from "@abstractions/BreakpointInfo";
import type { SourceStep } from "@emu/machines/SourceStepDecision";
import type { ConditionSymbols } from "@common/utils/breakpoint-condition/condition-types";
import type { ConditionMachineInfo, ConditionStore } from "@emu/machines/conditionStore";
import type { LogLine } from "@emu/machines/DebugSupport";
import type { ConditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";

/**
 * This interface represents the properties and methods that support debugging an emulated machine.
 */
export interface IDebugSupport {
  /**
   * This member stores the last startup breakpoint to check. It allows setting a breakpoint to the first
   * instruction of a program.
   */
  lastStartupBreakpoint?: number;

  readonly breakpointDefs: Map<string, BreakpointInfo>;

  /**
   * The list of current execution breakpoints
   */
  readonly breakpoints: BreakpointInfo[];

  /**
   * Gets execution breakpoint information for the specified address/partition
   * @param address Breakpoint address
   * @param partitionResolver A function to resolve the current partition
   */
  shouldStopAt(address: number, partitionResolver: (address: number) => number | undefined): boolean;

  /**
   * Gets memory read breakpoint information for the specified address/partition
   * @param reads Addresses read during the current instruction
   * @param length Number of bytes read
   * @param partitionResolver A function to resolve the current partition
   */
  hasMemoryRead(reads: ArrayLike<number>, length: number, partitionResolver: (address: number) => number | undefined, values?: ArrayLike<number>): boolean;

  /**
   * Gets memory write breakpoint information for the specified address/partition
   * @param writes Addresses written during the current instruction
   * @param length Number of bytes written
   * @param partitionResolver A function to resolve the current partition
   */
  hasMemoryWrite(writes: ArrayLike<number>, length: number, partitionResolver: (address: number) => number | undefined, values?: ArrayLike<number>): boolean;

  /**
   * Does any breakpoint in this set watch memory or I/O access?
   *
   * Execution breakpoints are tested against the program counter, which an emulated machine always
   * has to hand. Memory and I/O breakpoints are tested against the bus activity of the *last*
   * instruction, which a WASM-backed machine has to mirror out of its core one accessor at a time.
   * That mirroring is pure overhead when nothing watches for it, so the per-instruction debug loops
   * ask this first and skip the import when it answers false.
   */
  hasAccessBreakpoints(): boolean;

  /**
   * Does any breakpoint watch a Next Register write?
   *
   * The ZX Spectrum Next counterpart of `hasAccessBreakpoints`, asked once per debug-loop entry for
   * the same reason: pushing the watch table into the core is pure overhead when nothing is armed.
   */
  hasNextRegBreakpoints(): boolean;

  /**
   * The watch table to push into the ZX Spectrum Next core: three 256-byte rows - flags, value,
   * mask - rebuilt from the current definitions on each call.
   *
   * The core matches approximately against this (one slot per register cannot hold two value
   * filters) and reports what it catches; `hasNextRegWrite` then makes the exact decision.
   */
  buildNextRegWatch(): Uint8Array;

  /**
   * Does any breakpoint want to stop on this NextReg write?
   *
   * @param reg The register written
   * @param value The value written
   * @param origin Which writer performed it; copper writes are opt-in per breakpoint
   */
  hasNextRegWrite(reg: number, value: number, origin: "cpu" | "copper"): boolean;

  /**
   * Gets IO read breakpoint information for the specified port
   * @param port Port read during the current instruction
   */
  hasIoRead(port: number, value?: number): boolean;

  /**
   * Gets IO write breakpoint information for the specified port
   * @param port Port written during the current instruction
   */
  hasIoWrite(port: number, value?: number): boolean;

  /**
   * The breakpoint flags of every address (`EXEC_BP`, `PART_BP`, ... in `DebugSupport`). Optional: a
   * WASM machine copies them into its core to find candidate stops without leaving it for every
   * instruction, and falls back to asking `shouldStopAt` per instruction without them.
   */
  readonly breakpointFlags?: Uint16Array;

  /**
   * The last breakpoint we stopped in the frame
   */
  lastBreakpoint?: number;

  /**
   * Breakpoint used for step-out debugging mode
   */
  imminentBreakpoint?: number;

  /**
   * The source-level step in progress (`DebugStepMode.SourceStep`), and after it stopped, how.
   */
  sourceStep?: SourceStep;

  /**
   * A runtime-error stop (plan §10.10): the address of a compiled program's error routine. Every
   * debug run stops when execution reaches it, before the ROM prints the report.
   */
  errorStopAddress?: number;

  /**
   * The ROM's error restart (RST 8 at $0008), where errors the ROM raises itself end up (the
   * calculator's "6 Number too big"). A debug run stops there only while `romErrorGuard` says a
   * compiled program is running, so BASIC's own errors after the program has ended do not stop.
   */
  romErrorAddress?: number;
  romErrorGuard?: () => boolean;

  /** Follows the running source statement through a debug run (`CurrentStatementTracker`). */
  statementTracker?: { observe(pc: number, getPartition?: (address: number) => number | undefined): void; current: number };

  /**
   * Erases all breakpoints
   */
  eraseAllBreakpoints(): void;

  /**
   * Adds a breakpoint to the list of existing ones
   * @param breakpoint Breakpoint information
   * @returns True, if a new breakpoint was added; otherwise, if an existing breakpoint was updated, false
   */
  addBreakpoint(breakpoint: BreakpointInfo): boolean;

  /**
   * Removes a breakpoint
   * @param address Breakpoint address
   * @returns True, if the breakpoint has just been removed; otherwise, false
   */
  removeBreakpoint(breakpoint: BreakpointInfo): boolean;

  /**
   * Enables or disables the specified breakpoint
   * @param address Breakpoint address
   * @param enabled Is the breakpoint enabled?
   * @returns True, if the breakpoint exists, and it has been updated; otherwise, false
   */
  enableBreakpoint(breakpoint: BreakpointInfo, enabled: boolean): boolean;

  /**
   * Scrolls down breakpoints
   * @param def Breakpoint address
   * @param lineNo Line number to shift down
   * @param lowerBound Lower bound of area to remove breakpoints from
   * @param upperBound Upper bound of area to remove breakpoints from
   */
  scrollBreakpoints(def: BreakpointInfo, shift: number, lowerBound?: number,
    upperBound?: number): void;

  /**
   * Normalizes source code breakpoint. Removes the ones that overflow the
   * file and also deletes duplicates.
   * @param lineCount
   * @returns
   */
  normalizeBreakpoints(resource: string, lineCount: number): void;

  /**
   * Resets the resolution of breakpoints
   */
  resetBreakpointResolution(): void;

  /**
   * Resolves the specified resouce breakpoint to an address, and optionally to a partition.
   *
   * @param partition The memory partition the line's code lives in, for a line inside a `.bank`
   * segment. Absent for unbanked code, which stays partitionless.
   */
  resolveBreakpoint(resource: string, line: number, address: number, partition?: number, column?: number): void;

  /**
   * Renames breakpoints when the source file is renamed
   */
  renameBreakpoints(oldResource: string, newResource: string): void;

  /**
   * While set, only session-owned breakpoints may stop the machine.
   *
   * Set for the window in which an injection flow's keystrokes are still in flight: a user
   * breakpoint pausing the machine there would expire every keystroke that has not landed yet and
   * leave the OS command line half-typed. See `.plans/NEX_DEBUGGING_PLAN.md` §9.5.
   */
  suppressUserBreakpoints: boolean;

  /** While `suppressUserBreakpoints` is set: whether keystrokes are still queued (checked when a breakpoint is hit). */
  keystrokesPending?: () => boolean;

  /**
   * The stop has been taken: removes exactly the one-shots among the definitions whose filters
   * passed for it (any kind), and returns how many. A no-op when nothing fired.
   */
  consumeFiredOneShots(): number;

  /** The definitions that stopped the machine at the last stop (the stop report, S11). */
  lastStopBreakpoints: BreakpointInfo[];

  /** For each of `lastStopBreakpoints`: the address it fired at and the accessed value. */
  lastStopAccesses: { address: number; value?: number }[];

  /** The registers and memory reads of a DeZog expression, as the machine holds them now. */
  describeDezogValues(text: string): string;

  /** A run starts: forget what fired and the previous stop's definitions. */
  clearFiredBreakpoints(): void;

  /**
   * Replaces the breakpoints owned by `scope`, leaving every other owner's alone.
   * @param breakpoints Breakpoints to install for this scope
   * @param scope Which existing breakpoints this call may remove
   */
  resetBreakpointsTo(breakpoints: BreakpointInfo[], scope: BreakpointScope): void;

  /**
   * The machine's condition evaluator: its core's program store
   * (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`). Set once per machine.
   */
  conditionStoreProvider?: () => ConditionStore | undefined;

  /** The machine facts conditions compile against. */
  setConditionEnvironment(facts: ConditionMachineFacts): void;

  /** The symbols conditions are bound to now. */
  readonly conditionSymbolTable: ConditionSymbols;

  /** The program symbols condition labels bind to; re-binds every condition (§3.6). */
  setConditionSymbols(symbols: ConditionSymbols): void;

  /** Zero one breakpoint's hit counter, or all of them (C12). */
  resetHitCounts(breakpoint?: BreakpointInfo): boolean;

  /** Did a hit counter move since the last call? (throttled panel refresh, §4.5) */
  takeHitsChanged(): boolean;

  /** The breakpoints with their runtime state (hit count, condition error/inactive). */
  listBreakpointsWithState(): BreakpointInfo[];

  // --- Logpoints (`.plans/LOGPOINTS_PLAN.md` §4.2)

  /** The clock, frame counter and slot map logpoints and conditions read. */
  machineInfo?: ConditionMachineInfo;

  /** Set by `shouldStopAtDebugPoint`: is the execution address being arrived at (L5)? */
  logArrival?: boolean;

  /** The PC of the last stop decision; cleared on a machine start. */
  lastDecisionPc?: number;

  /** The log lines queued since the last call, and how many the per-frame cap dropped. */
  takeLogLines(): { lines: LogLine[]; dropped: number };

  /** Are log lines waiting? */
  readonly hasPendingLog: boolean;

  /** Switch logpoint groups: all on, all off, or only the listed ones. */
  setLogGroups(state: LogpointGroupState | undefined): void;

  /** Does this group log now? */
  isLogGroupEnabled(group: string): boolean;
}

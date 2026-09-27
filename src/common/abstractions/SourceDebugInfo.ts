/**
 * Extensions to `SourceLevelDebugInfo` (`CompilerInfo.ts`) for source stepping over calls, the
 * symbolic call stack and the Variables panel (plan `.plans/ZXBASIC_COMPILER_PLAN.md` §8.4,
 * §10.2). Klive BASIC is the first producer; nothing here is BASIC-specific, so another compiler
 * that follows the same frame conventions can fill it too.
 *
 * Everything is JSON-serialisable: it crosses IPC and the worker boundary.
 */

/** The value types the debugger decodes. */
export type SourceValueType =
  | "byte"
  | "ubyte"
  | "integer"
  | "uinteger"
  | "long"
  | "ulong"
  | "fixed"
  | "float"
  | "string"
  | "boolean";

/** Where a variable's value (or, for `byRef`, its address) lives. */
export type VariableDebugLocation =
  /** A global: its first byte. */
  | { at: "absolute"; address: number; partition?: number }
  /** A parameter (>= 4) or local (< 0): the first byte of its value, relative to the frame's IX. */
  | { at: "frame"; ixOffset: number }
  | { at: "constant"; value: number | string };

export type VariableDebugInfo = {
  /** As declared, without a sigil. */
  name: string;
  /** As the source writes it, with its sigil. */
  displayName: string;
  type: SourceValueType;
  kind: "global" | "local" | "parameter" | "constant";
  /** The location holds the value's address (a BYREF parameter, an array parameter's descriptor). */
  byRef?: boolean;
  location: VariableDebugLocation;
  /**
   * An array: `location` is its descriptor (runtime ABI §2.3: dimension table, data, lower-bound
   * table, upper-bound table). `dimensions` are the declared bounds; an array parameter has none
   * (they come with the argument's descriptor).
   */
  array?: { elementType: SourceValueType; dimensions?: { lower: number; upper: number }[] };
  /** A global, or a SUB/FUNCTION's parameter or local (visible while its activation is selected). */
  scope: "global" | { callableIndex: number };
  declaredAt: { fileIndex: number; line: number; column: number };
};

/** A call of a user routine, a GOSUB or an ON ... GOSUB dispatch: one Z80 `call` (guarantee G5). */
export type CallSiteDebugInfo = {
  /** The address right after the `call`: what the stack holds while the callee runs. */
  returnAddress: number;
  partition?: number;
  /** Index into `SourceLevelDebugInfo.statements`: the calling statement; -1 when it is not the user's (library code). */
  statementIndex: number;
  /** The callable the call is made from. */
  callerIndex: number;
  kind: "sub" | "function" | "gosub" | "on-gosub" | "far";
  /** The called SUB or FUNCTION; absent for GOSUB and ON ... GOSUB (the subroutine runs in the caller's callable). */
  calleeIndex?: number;
  /** The statement makes further user calls after this one (a return-point stop, §10.2.3). */
  moreCallsFollow: boolean;
  /** Evaluation order within the statement (Step Into Target, §10.2.4). */
  order: number;
};

/** How to find a callable's activation on the stack (§10.2.2). */
export type CallableFrameInfo = {
  callableIndex: number;
  /**
   * `frame`: a routine that builds an IX frame (`push ix; ld ix,0; add ix,sp`; locals below IX, the
   * return address at IX+2); `entrypoint`: the main program, whose baseline SP is in
   * `mainBaselineSymbol`.
   */
  convention: "frame" | "entrypoint";
  /** `frame`: bytes from the baseline SP (every statement entry's SP) to the return-address slot. */
  returnSlotOffset?: number;
  /** `frame`: bytes of stack arguments above the return address, which the routine removes. */
  argBytes?: number;
  /** The callable's first code byte (its label: the prologue starts here). */
  startAddress: number;
  /** The first address after the prologue: IX is valid from here. */
  bodyStart: number;
  /** The first address of the epilogue: IX is valid until here. */
  epilogueStart: number;
  /** One past the callable's last code byte. */
  endAddress: number;
  /** FUNCTIONs only: how the result is returned (A, HL, DE:HL, A-E-D-C-B, a String pointer in HL). */
  returnType?: SourceValueType;
  /** Library code (not the user's source): stepping runs through it, like the runtime. */
  library?: boolean;
};

export type SourceDebugExtensions = {
  variables: VariableDebugInfo[];
  callSites: CallSiteDebugInfo[];
  /** One per callable, in callable order. */
  frames: CallableFrameInfo[];
  /** The address of the word where the prologue stores the main program's baseline SP. */
  mainBaselineSymbol: number;
  /** Runtime entry points, for disassembly labels and the call stack's runtime rows. */
  runtimeSymbols: { name: string; address: number }[];
  /** The runtime's error routine (§10.10): a debug run can stop here with the BASIC error. */
  errorEntry?: number;
  optimizationLevel: number;
};

/** The registers a FUNCTION result is decoded from at a return point (§10.2.6). */
export type SourceReturnRegisters = { af: number; bc: number; de: number; hl: number };

/**
 * Where a paused program stands at source level, as the emulator reports it after a stop: how it
 * stopped, the statement to show (for a return point, the calling statement), and the FUNCTION
 * results that returned during the last source step.
 */
export type SourceStopInfo = {
  /** `error`: stopped at the runtime's error routine (§10.10), before the ROM's report. */
  kind: "statement" | "returnPoint" | "error" | "other";
  pc: number;
  /** Index into `SourceLevelDebugInfo.statements`, or -1 (runtime code, the ROM). */
  statementIndex: number;
  /** In runtime code: the user statement that called into it (-1 when none is found). */
  userStatementIndex?: number;
  /** An error stop: the ERR_NR code and the ROM report it names (`3 Subscript wrong`). */
  error?: { code: number; report: string };
  /** A return point: the SUB or FUNCTION that just returned. */
  returnedFrom?: number;
  /** A return point: a GOSUB subroutine just returned. */
  returnedFromGosub?: boolean;
  returned: { callableIndex: number; registers: SourceReturnRegisters }[];
};

/** One activation of the symbolic call stack (§10.6), innermost first. */
export type SourceActivationInfo = {
  callableIndex: number;
  kind: "main" | "routine" | "gosub";
  /** SP at the activation's statement entries. */
  baseline: number;
  /** The word holding its return address (absent for the main program). */
  returnSlot?: number;
  /** The call that started it: its statement is where the caller stands. */
  callSite?: CallSiteDebugInfo;
  /** A routine's frame pointer, for its parameters and locals. */
  ix?: number;
};

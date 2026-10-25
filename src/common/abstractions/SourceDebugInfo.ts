/**
 * Extensions to `SourceLevelDebugInfo` (`CompilerInfo.ts`) for source stepping over calls, the
 * symbolic call stack and the Variables panel (plan `.plans/ZXBASIC_COMPILER_PLAN.md` §8.4, §10.2;
 * made language-neutral by `.plans/SHARED_Z80_BACKEND_PLAN.md` Part B, model version 2).
 *
 * The vocabulary is the machine's and the calling convention's, never a language's: statements,
 * callables, activations, call sites, value *representations*, memory locations, banks. What belongs
 * to a language (type names, how a local subroutine is labelled, the error reports) arrives as data
 * from the producer, or from the debugger's language plugin. Producers: Klive BASIC (the shared Z80
 * back end), Boriel BASIC (`boriel-integration/dbg-adapter.ts`), z88dk C
 * (`z88dk-integration/z88dk-debug-adapter.ts`). `.docs/source-debugging-model.md` describes it.
 *
 * Everything is JSON-serialisable: it crosses IPC and the worker boundary, and is kept in the NEX
 * debug sidecar (`source-debug-sidecar.ts`), whose readers upgrade version 1 (`source-debug-upgrade.ts`).
 */

/** The model version this file describes (the sidecar's format version follows it). */
export const SOURCE_DEBUG_MODEL_VERSION = 2;

/**
 * The value representations the debugger has decoders for out of the box: how the bytes are laid
 * out, never what a language calls the type (that is `typeLabel`).
 *
 * - `i8` … `u32`: little-endian two's complement or unsigned integers.
 * - `bool`: one byte, 0 is false and anything else true; a new value is stored as 1.
 *   `bool/ff`: the same, stored as 255 (a language whose TRUE is -1).
 * - `char8`: a signed byte shown with its character (C's `char`).
 * - `ptr16`: a 16-bit address, shown in hex.
 * - `fix16.16`: a signed 16.16 fixed-point number in four bytes.
 * - `float40`: the ZX Spectrum ROM's five-byte floating point.
 * - `str.heap`: a 16-bit pointer to a heap block `[length word][characters]`, 0 for the empty string.
 * - `str.c`: a 16-bit pointer to NUL-terminated characters.
 * - `str.short:<capacity>`: inline, a length byte followed by `capacity` character bytes.
 */
export type BuiltinValueRepresentation =
  | "i8"
  | "u8"
  | "i16"
  | "u16"
  | "i32"
  | "u32"
  | "bool"
  | "bool/ff"
  | "char8"
  | "ptr16"
  | "fix16.16"
  | "float40"
  | "str.heap"
  | "str.c";

/**
 * A value's representation: a built-in one, `str.short:<capacity>`, or one a language plugin
 * registers a decoder for. A representation without a decoder is shown as its bytes in hex.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type SourceValueType = BuiltinValueRepresentation | `str.short:${number}` | (string & {});

/** Where a variable's value (or, for `byRef`, its address) lives. */
export type VariableDebugLocation =
  /** A global: its first byte. */
  | { at: "absolute"; address: number; partition?: number }
  /** A parameter (>= 4) or local (< 0): the first byte of its value, relative to the frame pointer. */
  | { at: "frame"; ixOffset: number }
  | { at: "constant"; value: number | string };

export type VariableDebugInfo = {
  /** As declared, without a sigil. */
  name: string;
  /** As the source writes it, with its sigil. */
  displayName: string;
  /** How the value is stored. */
  type: SourceValueType;
  /** The type as the source declares it (`Integer`, `unsigned int`, `char *`): what the panel shows. */
  typeLabel: string;
  kind: "global" | "local" | "parameter" | "constant";
  /** The location holds the value's address (a by-reference parameter, an array parameter's descriptor). */
  byRef?: boolean;
  location: VariableDebugLocation;
  /**
   * An array. `descriptor`: `location` holds a runtime array descriptor (Klive/Boriel runtime ABI
   * §2.3: dimension table, data, lower-bound table, upper-bound table); an array parameter has no
   * `dimensions` (they come with the argument's descriptor). `inline`: the elements themselves are at
   * `location`, row-major, with the declared `dimensions`.
   */
  array?: {
    elementType: SourceValueType;
    /** The element type as the source declares it. */
    elementLabel?: string;
    layout: "descriptor" | "inline";
    dimensions?: { lower: number; upper: number }[];
  };
  /** A global, or a routine's parameter or local (visible while its activation is selected). */
  scope: "global" | { callableIndex: number };
  declaredAt: { fileIndex: number; line: number; column: number };
  /**
   * CODEBANK: the logical bank of bank-local data. Its descriptor (and an array's data and tables)
   * lives in the bank's page(s) at the window's addresses, so it is read through the bank's pages
   * (`codebank.banks`), not through whatever the window holds now.
   */
  bank?: number;
};

/**
 * One Z80 `call` of user code (guarantee G5). `routine`: a call of a callable, which gets an
 * activation of its own (a SUB, FUNCTION, C function, Pascal procedure). `local`: a call into code of
 * the caller's own callable, which runs in the caller's activation and frame (BASIC's GOSUB).
 */
export type CallSiteDebugInfo = {
  /** The address right after the `call`: what the stack holds while the callee runs. */
  returnAddress: number;
  partition?: number;
  /** Index into `SourceLevelDebugInfo.statements`: the calling statement; -1 when it is not the user's (library code). */
  statementIndex: number;
  /** The callable the call is made from. */
  callerIndex: number;
  kind: "routine" | "local";
  /** Reached through a table of targets (ON ... GOSUB): the callee is decided at run time. */
  dispatch?: true;
  /** A `routine` call whose callee returns a value. */
  returnsValue?: true;
  /** The called callable (`routine` calls). */
  calleeIndex?: number;
  /** The statement makes further user calls after this one (a return-point stop, §10.2.3). */
  moreCallsFollow: boolean;
  /** Evaluation order within the statement (Step Into Target, §10.2.4). */
  order: number;
};

/** The registers a callable returns its result in (decoded at a return point, §10.2.6). */
export type ReturnRegisters = "a" | "hl" | "dehl" | "aedcb";

/** How to find a callable's activation on the stack (§10.2.2). */
export type CallableFrameInfo = {
  callableIndex: number;
  /**
   * `frame`: a routine that builds a frame (`push ix; ld ix,0; add ix,sp`, or a frame pointer kept in
   * memory; locals below it, the return address 2 bytes above it); `entrypoint`: the main program,
   * whose baseline SP is in `mainBaselineSymbol`; `fastcall`: a frameless routine (its first argument
   * arrives in registers and its return address is the stack word at its baseline).
   */
  convention: "frame" | "entrypoint" | "fastcall";
  /** `frame`: bytes from the baseline SP (every statement entry's SP) to the return-address slot. */
  returnSlotOffset?: number;
  /** `frame`: bytes of stack arguments above the return address, which the routine removes. */
  argBytes?: number;
  /** The callable's first code byte (its label: the prologue starts here). */
  startAddress: number;
  /** The first address after the prologue: the frame pointer is valid from here. */
  bodyStart: number;
  /** The first address of the epilogue: the frame pointer is valid until here. */
  epilogueStart: number;
  /** One past the callable's last code byte. */
  endAddress: number;
  /** CODEBANK: the 8K page the callable's code lives in (its addresses are the window's); undefined for resident code. */
  partition?: number;
  /** A callable that returns a value: its representation, its declared type and the registers it is in. */
  returns?: { type: SourceValueType; typeLabel: string; in: ReturnRegisters };
  /** Library code (not the user's source): stepping runs through it, like the runtime. */
  library?: boolean;
};

/**
 * Where a debug run can stop on a run-time error (§10.10), and how to name the error: the code is
 * read from a register or a memory byte at `entry`, and named by a report table — `zx-rom` for the
 * ZX Spectrum ROM's reports (`src/common/zx/rom-reports.ts`), or the producer's own texts by code.
 */
export type ErrorStopInfo = {
  entry: number;
  code: { register: "a" } | { address: number };
  reports: "zx-rom" | string[];
};

export type SourceDebugExtensions = {
  variables: VariableDebugInfo[];
  callSites: CallSiteDebugInfo[];
  /** One per callable, in callable order. */
  frames: CallableFrameInfo[];
  /** The address of the word where the prologue stores the main program's baseline SP. */
  mainBaselineSymbol: number;
  /**
   * A frame pointer kept in memory instead of IX: the address of the word that holds it. sccz80's
   * debug builds (z88dk, `.ai/z88dk/cdb-records.md`, "Frames") keep the same layout as an IX frame -
   * the caller's frame pointer at FP, the return address at FP+2 - in the word `__debug_framepointer`.
   * The frame locator reads it wherever it would read IX.
   */
  framePointerAddress?: number;
  /** Named code addresses (a line number's digits or a label's name), sorted by address: local activations are labelled by them. */
  labels?: { name: string; address: number }[];
  /** Files of the standard library: Just My Code steps through their statements (§10.12). */
  libraryFiles?: number[];
  /** Runtime entry points, for disassembly labels and the call stack's runtime rows. */
  runtimeSymbols: { name: string; address: number }[];
  /** The run-time error stop (§10.10). */
  errorStop?: ErrorStopInfo;
  /** CODEBANK (plan §9.4): where banked code runs and the far-call runtime's state, for the frame locator. */
  codebank?: CodebankDebugInfo;
  optimizationLevel: number;
};

/**
 * How the far-call runtime records a cross-bank call still running: one record per call, the newest
 * at the shadow stack pointer's end. Klive's runtime: 3-byte records `[bank, return]` growing up from
 * `shadowStack`. Boriel BASIC's (`.ai/boriel/dbg-observed.md`, "Far calls"): 4-byte records
 * `[return, flags, paging]` pushed downwards from `shadowStack` (the area's end), the bank being the
 * paging byte masked with `bankMask`.
 */
export type FarCallRecordLayout = {
  /** Bytes per record. */
  size: number;
  /** `up`: record k is at `shadowStack + size * k`; `down`: at `shadowStack - size * (k + 1)`. */
  grows: "up" | "down";
  /** The offset of the caller's bank byte and of the return address word in a record. */
  bankOffset: number;
  returnOffset: number;
  /** The bank byte masked with this is the logical bank (default 0xff). */
  bankMask?: number;
  /** The alignment of return slots on the stack: 2 when the runtime keeps the stack word-aligned, 1 when not. */
  slotStride: 1 | 2;
};

/**
 * The far-call runtime as the debugger sees it (plan §9.2, §9.4). Banked code runs at the window's
 * addresses, so an address there means nothing without its 8K page. On a cross-bank call the callee's
 * return slot holds `farReturn`; the real return address and the caller's bank are in the shadow
 * stack's records (`records`).
 */
export type CodebankDebugInfo = {
  /** The window's first address and its size in bytes (8K or 16K). */
  window: number;
  windowSize: number;
  /** The far-call entry every trampoline calls, and the far return a cross-bank callee returns to. */
  farCall: number;
  farReturn: number;
  /** The byte holding the current logical bank (0: resident, the window as the loader left it). */
  currentBank: number;
  /** The word holding the shadow stack's pointer, and the shadow stack's base (see `records.grows`). */
  shadowStackPointer: number;
  shadowStack: number;
  /** How a record is laid out. */
  records: FarCallRecordLayout;
  /** Each logical bank's 8K pages, in window order (two for a 16K window). */
  banks: { bank: number; pages: number[] }[];
};

/** The registers a result is decoded from at a return point (§10.2.6). */
export type SourceReturnRegisters = { af: number; bc: number; de: number; hl: number };

/**
 * Where a paused program stands at source level, as the emulator reports it after a stop: how it
 * stopped, the statement to show (for a return point, the calling statement), and the results that
 * returned during the last source step.
 */
export type SourceStopInfo = {
  /** `error`: stopped at the run-time error stop (§10.10), before the ROM's report. */
  kind: "statement" | "returnPoint" | "error" | "other";
  pc: number;
  /** Index into `SourceLevelDebugInfo.statements`, or -1 (runtime code, the ROM). */
  statementIndex: number;
  /** In runtime code: the user statement that called into it (-1 when none is found). */
  userStatementIndex?: number;
  /** An error stop: the error's code and the report that names it (`3 Subscript wrong`). */
  error?: { code: number; report: string };
  /** A return point: the callable that just returned. */
  returnedFrom?: number;
  /** A return point: a local activation just returned. */
  returnedFromLocal?: boolean;
  returned: { callableIndex: number; registers: SourceReturnRegisters }[];
};

/** One activation of the symbolic call stack (§10.6), innermost first. */
export type SourceActivationInfo = {
  callableIndex: number;
  /** `local`: entered by a `local` call; it runs in its callable's activation and frame. */
  kind: "entry" | "routine" | "local";
  /** SP at the activation's statement entries. */
  baseline: number;
  /** The word holding its return address (absent for the main program). */
  returnSlot?: number;
  /** The call that started it: its statement is where the caller stands. */
  callSite?: CallSiteDebugInfo;
  /** A routine's frame pointer, for its parameters and locals. */
  ix?: number;
};

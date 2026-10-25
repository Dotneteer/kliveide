import type { StatementKind } from "@abstractions/CompilerInfo";
import type { VariableDebugInfo } from "@abstractions/SourceDebugInfo";

import { representationOf, type RegClass } from "./representations";

/**
 * The MIR (`.docs/z80-backend-mir.md`): the shared Z80 back end's input. Per function, a control-flow
 * graph of blocks whose instructions compute into single-assignment virtual registers and read and
 * write variables through slots. Every instruction and terminator carries the statement id (sid) it
 * belongs to.
 *
 * It is language-neutral (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.4, §4.1): its types are value
 * *representations* (`representations.ts`), and every operation whose meaning differs between
 * languages states the meaning it wants (`rounding`, `overflow`, `toInt`, `shift`, `truth`). A front
 * end lowers its language to it; nothing here knows which language that was.
 */

// =================================================================================================
// Source positions

/** A source range: a file of the front end's source set and character offsets in it. */
export type Span = { file: number; start: number; end: number };

// =================================================================================================
// Types and values

/** The representations the back end knows (`representations.ts`): sizes, registers, runtime packages. */
export type MType = "i8" | "u8" | "i16" | "u16" | "i32" | "u32" | "fix" | "flt" | "str" | "bool" | "ptr";

/** Bytes a value of the type occupies in memory. */
export function mtypeSize(t: MType): number {
  return representationOf(t).size;
}

export function isSignedM(t: MType): boolean {
  return representationOf(t).signed;
}

export type { RegClass } from "./representations";

/** The register class of a value: which accumulator holds it at level 0 (LIR note §4). */
export function regClassOf(t: MType): RegClass {
  return representationOf(t).regClass;
}

export type VReg = { kind: "vreg"; id: number; type: MType };
/** An integer (or bool) constant; `fix` holds the raw 16.16 value. */
export type Imm = { kind: "imm"; type: MType; value: number };
/** An address the assembler resolves: a label (plus offset). String literals are `str` symbols. */
export type SymRef = { kind: "sym"; type: MType; name: string; offset: number };
export type Value = VReg | Imm | SymRef;

// =================================================================================================
// Slots: where variables live

export type Slot =
  /** A global variable at an assembler label or constant address expression (`_x`, `23672`). */
  | { kind: "global"; name: string }
  /** A frame slot at an IX offset: locals below IX, parameters from IX+4. */
  | { kind: "frame"; offset: number }
  /** The value at an address held in a `ptr` value. */
  | { kind: "deref"; ptr: Value };

// =================================================================================================
// Instructions

export type BinOp =
  | "add" | "sub" | "mul" | "div" | "mod" | "pow"
  | "and" | "or" | "xor" | "shl" | "shr"
  | "eq" | "ne" | "lt" | "le" | "gt" | "ge"
  | "land" | "lor" | "lxor";

export const COMPARISONS: ReadonlySet<BinOp> = new Set(["eq", "ne", "lt", "le", "gt", "ge"]);

/**
 * The meanings an operation may have, where languages disagree (§3.4). A front end states the one it
 * wants; the verifier rejects an operation that needs one and has none, and one the selector does not
 * implement yet.
 *
 * - `rounding` (integer `div`, `mod`): `trunc` truncates towards zero (the remainder takes the
 *   dividend's sign); `floor` rounds towards minus infinity (the remainder takes the divisor's sign);
 *   `magnitude` (`mod` only): the remainder of the magnitudes, never negative.
 * - `overflow` (integer `add`, `sub`, `mul`, `shl`, `neg`, narrowing `conv`): `wrap` keeps the low
 *   bits; `check` raises the language's overflow error.
 * - `toInt` (`conv` of a real to an integer): `trunc`, `floor`, `round-half-even`, `round-half-away`.
 * - `shift` (`shr` of a signed integer): `arith` keeps the sign; `logical` shifts zeros in.
 * - `truth` (`conv` between `bool` and a stored value): how the language stores true — `01` (1),
 *   `0ff` (-1, all bits set); a `bool` in a vreg is always 0 or 1.
 */
export type Rounding = "trunc" | "floor" | "magnitude";
export type Overflow = "wrap" | "check";
export type ToInt = "trunc" | "floor" | "round-half-even" | "round-half-away";
export type Shift = "arith" | "logical";
export type Truth = "01" | "0ff";

/** Debugger facts about one user call (plan §8.4 `CallSiteDebugInfo`, G5). */
export type CallSite = {
  /**
   * `routine`: a call of a function of the module, which gets an activation of its own. `local`: a
   * call into a block of the caller's own function, which runs in the caller's activation (BASIC's
   * GOSUB). `runtime`: a call the debugger counts as runtime code (no call-site record).
   */
  kind: "routine" | "local" | "runtime";
  callee?: string;
  /** A `routine` call of a function that returns a value. */
  returnsValue?: boolean;
  /** Reached through a table of targets (a dispatching `switch`). */
  dispatch?: boolean;
  /** The statement makes further user calls after this one. */
  moreCallsFollow: boolean;
  /** Evaluation order within the statement. */
  order: number;
};

export type Instr = { sid: number } & (
  /** The entry of statement `sid` (a zero-size marker, `.docs/z80-backend-mir.md` §6). */
  | { op: "stmt" }
  | { op: "prologue.end" }
  | { op: "epilogue.begin" }
  | { op: "const"; dst: VReg; value: Imm | SymRef }
  | { op: "load"; dst: VReg; slot: Slot }
  | { op: "store"; type: MType; slot: Slot; src: Value }
  | { op: "addr"; dst: VReg; slot: Slot }
  /** `a` and `b` have the operand type; `dst` is that type, or `bool` for comparisons and logic. */
  | { op: "bin"; bop: BinOp; dst: VReg; a: Value; b: Value; rounding?: Rounding; overflow?: Overflow; shift?: Shift }
  | { op: "neg" | "not" | "lnot"; dst: VReg; a: Value; overflow?: Overflow }
  | { op: "conv"; dst: VReg; a: Value; toInt?: ToInt; overflow?: Overflow; truth?: Truth }
  /** A routine of the module. `args` in source order (the first argument first); evaluated last first. */
  | { op: "call"; dst?: VReg; target: string; convention: "stdcall" | "fastcall"; args: Value[]; site: CallSite }
  /** A runtime routine (`core.X`), whose register contract instruction selection knows. */
  | { op: "rtcall"; dst?: VReg; name: string; args: Value[] }
  /** The source's own inline assembly, in Klive's assembler dialect. */
  | { op: "asm"; lines: string[] }
  /**
   * A FASTCALL routine's first parameter back into the registers it arrived in (A, HL, DE:HL), from
   * the frame slot the prologue saved it to: for inline assembly that expects it there.
   */
  | { op: "param.reload" }
  /**
   * The result registers of the calling convention (A, HL, DE:HL, A-E-D-C-B for `type`) into the
   * frame slot at `offset`: for a routine whose inline assembly leaves its result in them.
   */
  | { op: "result.capture"; type: MType; offset: number }
);

export type Terminator = { sid: number } & (
  | { op: "jmp"; target: string }
  | { op: "br"; cond: Value; ifTrue: string; ifFalse: string }
  /**
   * A jump table: selector 0 takes the first target; out of range goes on to `otherwise`. With
   * `call`, each target is called as a `local` call (it returns to `otherwise`), and the call is a
   * recorded call site.
   */
  | { op: "switch"; sel: Value; targets: string[]; otherwise: string; call?: { site: CallSite } }
  /** A `local` call: a call of a block of the same function, which returns to `next`. */
  | { op: "localcall"; target: string; next: string; site: CallSite }
  /** From a routine (through its epilogue, with the result), or from a `local` call. */
  | { op: "ret"; value?: Value }
  /** A jump to the address a global slot holds (Klive BASIC's DATA items: READ jumps to the next one). */
  | { op: "jumpvia"; slot: Extract<Slot, { kind: "global" }> }
  /**
   * A jump, never returning, to a runtime routine that takes one value: in A (`width: 8`) or in BC
   * (`width: 16`). The language names the routine (Klive BASIC's END and its run-time errors).
   */
  | { op: "exit"; routine: string; value: Value; width: 8 | 16 }
);

export type Block = { label: string; instrs: Instr[]; term?: Terminator };

export type FrameSlot = { name: string; type: MType; offset: number };

/**
 * A variable as the debugger shows it (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.3), in the debugger's
 * vocabulary. The front end describes it; the back end turns `storage` into a location after
 * assembly.
 */
export type VariableDescriptor = {
  name: string;
  displayName: string;
  type: VariableDebugInfo["type"];
  typeLabel: string;
  kind: VariableDebugInfo["kind"];
  /** An assembler label (plus offset), a fixed address, a frame offset from IX, or a constant's value. */
  storage: { label: string; offset?: number } | { address: number } | { frameOffset: number } | { constant: number | string };
  byRef?: boolean;
  array?: VariableDebugInfo["array"];
  declaredAt: Span;
  /** CODEBANK: the logical bank of bank-local data. */
  bank?: number;
};

export type MFunction = {
  /** The routine's assembler label (`_name`), or `_main`. */
  label: string;
  name: string;
  /**
   * `entry`: the program's entry point (no frame, a plain `ret`); `routine`: a callable with a frame
   * (or a frameless `naked` one); `fragment`: code other code calls with no frame and a plain `ret`
   * (Klive BASIC's DATA items, which READ calls).
   */
  kind: "entry" | "routine" | "fragment";
  convention: "stdcall" | "fastcall";
  params: FrameSlot[];
  /** Locals (user and hidden) below IX; `frameSize` bytes in all. */
  locals: FrameSlot[];
  frameSize: number;
  /** Bytes of arguments on the stack, which the routine removes when it returns. */
  argBytes: number;
  /** FASTCALL: the first parameter arrives in A / HL and is pushed as the frame's first slot. */
  registerParam?: MType;
  /**
   * A frameless FASTCALL routine (Boriel compatibility plan C5): its body is only inline asm (and
   * labels), it has no prologue, and its end is a bare `ret`. The asm finds the first parameter in
   * A / HL / DE:HL and the return address at SP, removes the stack parameters itself and leaves the
   * result in the registers.
   */
  naked?: boolean;
  returnType?: MType;
  /** The result's type as the source language names it (the debugger shows it). */
  returnLabel?: string;
  blocks: Block[];
  /** The shared epilogue's label (`_name.leave`). */
  epilogue?: string;
  /** A routine: its definition in the source, from its header to its end (the debugger). */
  span?: Span;
  /** A routine: its parameters and locals and where each lives in the frame (the debugger). */
  vars?: VariableDescriptor[];
  /**
   * CODEBANK (plan §9): the logical bank the body lives in. Its label is then `_name.__far`, and a
   * resident trampoline at `_name` enters it through the far-call runtime.
   */
  bank?: number;
  /** Level 2: nothing reaches the routine (opt/unused-routines.ts): it gets no code. */
  removed?: boolean;
};

/** Data the program image holds: globals, string literals, tables. `bank`: bank-local (CODEBANK). */
export type DataItem = { bank?: number } & (
  | { kind: "var"; label: string; size: number; init?: number[] }
  | { kind: "string"; label: string; text: string }
  | { kind: "raw"; label: string; lines: string[] }
  /** A label for a fixed address (`DIM ... AT`). */
  | { kind: "equ"; label: string; value: string }
);

/** One statement (or statement part) for the debugger. */
export type StatementEntry = {
  sid: number;
  span: Span;
  kind: StatementKind;
  /** The index of the function (in MModule.functions) the statement belongs to. */
  functionIndex: number;
  /** An inline-asm statement: the span of each of its lines, to report the assembler's errors against. */
  asmLines?: Span[];
  /** The statement's routine was removed as unused (level 2): it has no code and no entry. */
  removed?: boolean;
  /** Level 3: the statement was inlined from this routine (its index in MModule.functions) into `functionIndex`. */
  inlinedFrom?: number;
};

export type MModule = {
  functions: MFunction[];
  data: DataItem[];
  statements: StatementEntry[];
  /** Runtime labels the program calls (`core.X`), for linking. */
  runtime: Set<string>;
  /** The program's global variables and constants as the debugger shows them. */
  globals?: VariableDescriptor[];
  /** CODEBANK: where the program first puts something into a bank (errors about banks point here). */
  codebankSpan?: Span;
};

export function vregText(v: Value): string {
  switch (v.kind) {
    case "vreg":
      return `%${v.id}`;
    case "imm":
      return `${v.value}`;
    case "sym":
      return `@${symText(v)}`;
  }
}

/** A symbol with its offset, as assembly text (`_a.data`, `_a.data+4`, `_a.data-2`). */
export function symText(v: SymRef): string {
  return v.offset > 0 ? `${v.name}+${v.offset}` : v.offset < 0 ? `${v.name}${v.offset}` : v.name;
}

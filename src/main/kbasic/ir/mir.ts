import type { Span } from "../diagnostics";
import type { StatementKind } from "@abstractions/CompilerInfo";
import type { KType } from "../semantics/types";

/**
 * The MIR (`.docs/kbasic-mir.md`): per function, a control-flow graph of blocks whose instructions
 * compute into single-assignment virtual registers and read and write variables through slots.
 * Every instruction and terminator carries the statement id (sid) it belongs to.
 */

// =================================================================================================
// Types and values

export type MType = "i8" | "u8" | "i16" | "u16" | "i32" | "u32" | "fix" | "flt" | "str" | "bool" | "ptr";

export function mtypeOf(t: KType): MType {
  switch (t) {
    case "Byte":
      return "i8";
    case "UByte":
      return "u8";
    case "Integer":
      return "i16";
    case "UInteger":
      return "u16";
    case "Long":
      return "i32";
    case "ULong":
      return "u32";
    case "Fixed":
      return "fix";
    case "Float":
      return "flt";
    case "String":
      return "str";
    case "Boolean":
      return "bool";
  }
}

/** Bytes a value of the type occupies in memory. */
export function mtypeSize(t: MType): number {
  switch (t) {
    case "i8":
    case "u8":
    case "bool":
      return 1;
    case "i16":
    case "u16":
    case "str":
    case "ptr":
      return 2;
    case "i32":
    case "u32":
    case "fix":
      return 4;
    case "flt":
      return 5;
  }
}

export function isSignedM(t: MType): boolean {
  return t === "i8" || t === "i16" || t === "i32" || t === "fix" || t === "flt";
}

/** The register class of a value: which accumulator holds it at level 0 (LIR note §4). */
export type RegClass = "r8" | "r16" | "r32" | "rflt";

export function regClassOf(t: MType): RegClass {
  const size = mtypeSize(t);
  return size === 1 ? "r8" : size === 2 ? "r16" : size === 4 ? "r32" : "rflt";
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
  | "add" | "sub" | "mul" | "div" | "mod"
  | "and" | "or" | "xor" | "shl" | "shr"
  | "eq" | "ne" | "lt" | "le" | "gt" | "ge"
  | "land" | "lor" | "lxor";

export const COMPARISONS: ReadonlySet<BinOp> = new Set(["eq", "ne", "lt", "le", "gt", "ge"]);

/** Debugger facts about one user call (plan §8.4 `CallSiteDebugInfo`, G5). */
export type CallSite = {
  kind: "sub" | "function" | "gosub" | "on-gosub" | "far";
  callee?: string;
  /** The statement makes further user calls after this one. */
  moreCallsFollow: boolean;
  /** Evaluation order within the statement. */
  order: number;
};

export type Instr = { sid: number } & (
  /** The entry of statement `sid` (a zero-size marker, `.docs/kbasic-mir.md` §6). */
  | { op: "stmt" }
  | { op: "prologue.end" }
  | { op: "epilogue.begin" }
  | { op: "const"; dst: VReg; value: Imm | SymRef }
  | { op: "load"; dst: VReg; slot: Slot }
  | { op: "store"; type: MType; slot: Slot; src: Value }
  | { op: "addr"; dst: VReg; slot: Slot }
  /** `a` and `b` have the operand type; `dst` is that type, or `bool` for comparisons and logic. */
  | { op: "bin"; bop: BinOp; dst: VReg; a: Value; b: Value }
  | { op: "neg" | "not" | "lnot"; dst: VReg; a: Value }
  | { op: "conv"; dst: VReg; a: Value }
  /** A user routine. `args` in source order (the first argument first); evaluated last first. */
  | { op: "call"; dst?: VReg; target: string; convention: "stdcall" | "fastcall"; args: Value[]; site: CallSite }
  /** A runtime routine (`core.X`), whose register contract instruction selection knows. */
  | { op: "rtcall"; dst?: VReg; name: string; args: Value[] }
  | { op: "asm"; lines: string[] }
);

export type Terminator = { sid: number } & (
  | { op: "jmp"; target: string }
  | { op: "br"; cond: Value; ifTrue: string; ifFalse: string }
  /** ON ... GOTO: selector 0 takes the first target; out of range goes on to `otherwise`. */
  | { op: "switch"; sel: Value; targets: string[]; otherwise: string }
  | { op: "gosub"; target: string; next: string; site: CallSite }
  /** ON ... GOSUB: the compiler's own dispatch, so each target is a recorded call. */
  | { op: "ongosub"; sel: Value; targets: string[]; next: string; site: CallSite }
  /** From a routine (through its epilogue, with the FUNCTION's result), or from a GOSUB. */
  | { op: "ret"; value?: Value }
  | { op: "end"; code: Value }
  | { op: "raise"; code: Value }
);

export type Block = { label: string; instrs: Instr[]; term?: Terminator };

export type FrameSlot = { name: string; type: MType; offset: number };

export type MFunction = {
  /** The routine's assembler label (`_name`), or `_main`. */
  label: string;
  name: string;
  kind: "main" | "sub" | "function";
  convention: "stdcall" | "fastcall";
  params: FrameSlot[];
  /** Locals (user and hidden) below IX; `frameSize` bytes in all. */
  locals: FrameSlot[];
  frameSize: number;
  /** Bytes of arguments on the stack, which the routine removes when it returns. */
  argBytes: number;
  /** FASTCALL: the first parameter arrives in A / HL and is pushed as the frame's first slot. */
  registerParam?: MType;
  returnType?: MType;
  blocks: Block[];
  /** The shared epilogue's label (`_name.leave`). */
  epilogue?: string;
};

/** Data the program image holds: globals, string literals, the DATA table. */
export type DataItem =
  | { kind: "var"; label: string; size: number; init?: number[] }
  | { kind: "string"; label: string; text: string }
  | { kind: "raw"; label: string; lines: string[] }
  /** A label for a fixed address (`DIM ... AT`). */
  | { kind: "equ"; label: string; value: string };

/** One statement (or statement part) for the debugger. */
export type StatementEntry = {
  sid: number;
  span: Span;
  kind: StatementKind;
  /** The index of the function (in MModule.functions) the statement belongs to. */
  functionIndex: number;
};

export type MModule = {
  functions: MFunction[];
  data: DataItem[];
  statements: StatementEntry[];
  /** Runtime labels the program calls (`core.X`), for linking. */
  runtime: Set<string>;
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

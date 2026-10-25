import type { ReturnRegisters, SourceValueType } from "@abstractions/SourceDebugInfo";

import type { MType } from "./mir";

/**
 * The value representations of the shared Z80 back end (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.4):
 * what the back end needs to move, store, pass and return a value — its size, its register class,
 * the registers a routine returns it in — and how the debugger decodes it. What a language *means*
 * by an operation on it is stated on the MIR operation, never here.
 *
 * The integers, `bool` and `ptr` are the back end's own. `fix`, `flt` and `str` are representations
 * a runtime package implements: arithmetic on them is always a call into that package (`fixed`,
 * `float`, and Klive BASIC's `strings`). A new representation (a 6-byte real, a Pascal short
 * string) is a new entry here, with its package — and selector support for its register class when
 * it needs one the selector does not have yet.
 */

/** Which accumulator holds a value at level 0: A, HL, DE:HL, or A-E-D-C-B. */
export type RegClass = "r8" | "r16" | "r32" | "rflt";

export type Representation = {
  size: number;
  signed: boolean;
  regClass: RegClass;
  /** The registers a routine returns a result of this representation in. */
  returnsIn: ReturnRegisters;
  /** The representation the debugger decodes it as. */
  debug: SourceValueType;
  /** The runtime package that implements its operations (absent: the selector does them inline). */
  runtimePackage?: string;
};

const REPRESENTATIONS: Record<MType, Representation> = {
  i8: { size: 1, signed: true, regClass: "r8", returnsIn: "a", debug: "i8" },
  u8: { size: 1, signed: false, regClass: "r8", returnsIn: "a", debug: "u8" },
  bool: { size: 1, signed: false, regClass: "r8", returnsIn: "a", debug: "bool" },
  i16: { size: 2, signed: true, regClass: "r16", returnsIn: "hl", debug: "i16" },
  u16: { size: 2, signed: false, regClass: "r16", returnsIn: "hl", debug: "u16" },
  ptr: { size: 2, signed: false, regClass: "r16", returnsIn: "hl", debug: "u16" },
  i32: { size: 4, signed: true, regClass: "r32", returnsIn: "dehl", debug: "i32" },
  u32: { size: 4, signed: false, regClass: "r32", returnsIn: "dehl", debug: "u32" },
  /** 16.16 fixed point (the `fixed` package). */
  fix: { size: 4, signed: true, regClass: "r32", returnsIn: "dehl", debug: "fix16.16", runtimePackage: "core" },
  /** The ZX Spectrum ROM's five-byte float (the `float` package, through the ROM calculator). */
  flt: { size: 5, signed: true, regClass: "rflt", returnsIn: "aedcb", debug: "float40", runtimePackage: "core" },
  /** Klive BASIC's owned heap string handle: a pointer to [length][characters], or 0 (its `strings` package). */
  str: { size: 2, signed: false, regClass: "r16", returnsIn: "hl", debug: "str.heap", runtimePackage: "kbasic" }
};

export function representationOf(type: MType): Representation {
  return REPRESENTATIONS[type];
}

/** Whether a type is one of the back end's integers (`bool` and `ptr` included), on which it does arithmetic inline. */
export function isIntegerType(type: MType): boolean {
  return type !== "fix" && type !== "flt" && type !== "str";
}

/** Whether a type is a real number (`fix`, `flt`). */
export function isRealType(type: MType): boolean {
  return type === "fix" || type === "flt";
}

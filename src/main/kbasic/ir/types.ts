import type { SourceValueType } from "@abstractions/SourceDebugInfo";

import { isIntegerType, isRealType } from "../../z80-backend/mir/representations";
import type { Instr, MType } from "../../z80-backend/mir/mir";
import type { KType } from "../semantics/types";

/**
 * Klive BASIC's types and operations in the shared back end's terms (`.plans/SHARED_Z80_BACKEND_PLAN.md`
 * §3.4): which MIR representation each BASIC type is, and what BASIC means by the operations whose
 * meaning differs between languages.
 */

/** The representation of a BASIC type. */
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

/** A BASIC type as the debugger shows it: its representation and its name. */
export function debugTypeOf(t: KType): { type: SourceValueType; typeLabel: string } {
  const repr: Record<KType, SourceValueType> = {
    Byte: "i8",
    UByte: "u8",
    Integer: "i16",
    UInteger: "u16",
    Long: "i32",
    ULong: "u32",
    Fixed: "fix16.16",
    Float: "float40",
    String: "str.heap",
    Boolean: "bool"
  };
  return { type: repr[t], typeLabel: t };
}

/**
 * BASIC's meanings, stated on every operation that needs one (the semantics annex and the runtime's
 * contracts, `arith16.kz80.asm`, `arith32.kz80.asm`, `float.kz80.asm`):
 *
 * - integer division truncates towards zero; `MOD` is the remainder of the magnitudes, never
 *   negative (`-100 MOD 3` is 1, the annex's mod-sign);
 * - integer arithmetic and narrowing conversions wrap;
 * - a real (Float, Fixed) becomes an integer rounded towards minus infinity (the ROM's INT), then
 *   wrapped to the type's width (the annex's types.conversions);
 * - `SHR` of a signed value keeps the sign;
 * - a Boolean is stored as 1 for true.
 */
export function withBasicSemantics(i: Instr): Instr {
  switch (i.op) {
    case "bin": {
      if (!isIntegerType(i.a.type)) return i;
      if (i.bop === "div") return { ...i, rounding: "trunc" };
      if (i.bop === "mod") return { ...i, rounding: "magnitude" };
      if (i.bop === "add" || i.bop === "sub" || i.bop === "mul" || i.bop === "shl") return { ...i, overflow: "wrap" };
      if (i.bop === "shr") return { ...i, shift: "arith" };
      return i;
    }
    case "neg":
      return isIntegerType(i.a.type) ? { ...i, overflow: "wrap" } : i;
    case "conv": {
      const from = i.a.type;
      const to = i.dst.type;
      if (from === "bool" || to === "bool") return { ...i, truth: "01" };
      if (isRealType(from) && isIntegerType(to)) return { ...i, toInt: "floor", overflow: "wrap" };
      if (isIntegerType(from) && isIntegerType(to)) return { ...i, overflow: "wrap" };
      return i;
    }
    default:
      return i;
  }
}

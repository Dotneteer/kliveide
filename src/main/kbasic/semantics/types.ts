import type { TypeName } from "../syntax/keywords";

/**
 * The types of ZX BASIC values (spec `types`): the eight numeric primitives, String, and the
 * internal Boolean that comparisons and logical operators produce (1 byte, 0 or 1; it cannot be
 * named and counts as UByte in arithmetic).
 */
export type KType = "Byte" | "UByte" | "Integer" | "UInteger" | "Long" | "ULong" | "Fixed" | "Float" | "String" | "Boolean";

type TypeInfo = { size: number; signed: boolean; integral: boolean; min?: bigint; max?: bigint };

const INFO: Record<KType, TypeInfo> = {
  Boolean: { size: 1, signed: false, integral: true, min: 0n, max: 1n },
  Byte: { size: 1, signed: true, integral: true, min: -128n, max: 127n },
  UByte: { size: 1, signed: false, integral: true, min: 0n, max: 255n },
  Integer: { size: 2, signed: true, integral: true, min: -32768n, max: 32767n },
  UInteger: { size: 2, signed: false, integral: true, min: 0n, max: 65535n },
  Long: { size: 4, signed: true, integral: true, min: -(2n ** 31n), max: 2n ** 31n - 1n },
  ULong: { size: 4, signed: false, integral: true, min: 0n, max: 2n ** 32n - 1n },
  Fixed: { size: 4, signed: true, integral: false },
  Float: { size: 5, signed: true, integral: false },
  String: { size: 2, signed: false, integral: false }
};

/** The type a type keyword names (`UBYTE` -> `UByte`). */
export function typeOfName(name: TypeName): KType {
  switch (name) {
    case "BYTE":
      return "Byte";
    case "UBYTE":
      return "UByte";
    case "INTEGER":
      return "Integer";
    case "UINTEGER":
      return "UInteger";
    case "LONG":
      return "Long";
    case "ULONG":
      return "ULong";
    case "FIXED":
      return "Fixed";
    case "FLOAT":
      return "Float";
    case "STRING":
      return "String";
  }
}

/** The type a sigil fixes: `$` String, `%` Integer. */
export function typeOfSigil(sigil: "$" | "%"): KType {
  return sigil === "$" ? "String" : "Integer";
}

/** The size in bytes of a value (a String is its 2-byte pointer). */
export function sizeOf(t: KType): number {
  return INFO[t].size;
}

export function isSigned(t: KType): boolean {
  return INFO[t].signed;
}

/** Byte, UByte, Integer, UInteger, Long, ULong and Boolean. */
export function isIntegral(t: KType): boolean {
  return INFO[t].integral;
}

/** Fixed and Float. */
export function isDecimal(t: KType): boolean {
  return t === "Fixed" || t === "Float";
}

export function isNumeric(t: KType): boolean {
  return t !== "String";
}

/** The range of an integral type. */
export function integralRange(t: KType): { min: bigint; max: bigint } {
  const info = INFO[t];
  if (info.min === undefined || info.max === undefined) throw new Error(`${t} is not integral`);
  return { min: info.min, max: info.max };
}

/** The signed type of the same size (unary minus on an unsigned operand, spec `operators`). */
export function signedOf(t: KType): KType {
  switch (t) {
    case "UByte":
    case "Boolean":
      return "Byte";
    case "UInteger":
      return "Integer";
    case "ULong":
      return "Long";
    default:
      return t;
  }
}

/**
 * The type two operands meet in (spec `types.common_type_rule`): the same type stays; Float wins,
 * then Fixed; otherwise the larger size, made signed when either operand is signed (UByte and Byte
 * give Byte, UInteger and Byte give Integer). Boolean counts as UByte. Undefined when one operand is a
 * String and the other is not.
 */
export function commonType(a: KType, b: KType): KType | undefined {
  if (a === "Boolean") a = "UByte";
  if (b === "Boolean") b = "UByte";
  if (a === b) return a;
  if (a === "String" || b === "String") return undefined;
  if (a === "Float" || b === "Float") return "Float";
  if (a === "Fixed" || b === "Fixed") return "Fixed";
  const larger = sizeOf(a) >= sizeOf(b) ? a : b;
  return isSigned(a) || isSigned(b) ? signedOf(larger) : larger;
}

/**
 * The type of an integer constant that no declaration types: the smallest type that holds it,
 * unsigned when it is not negative (so `FOR i = 1 TO 10` counts in UByte and `FOR i = -1 TO 10` in
 * Byte, as the spec's FOR notes say); Float beyond the 32-bit range.
 */
export function literalIntegerType(value: bigint): KType {
  for (const t of value >= 0n ? (["UByte", "UInteger", "ULong"] as const) : (["Byte", "Integer", "Long"] as const)) {
    const { min, max } = integralRange(t);
    if (value >= min && value <= max) return t;
  }
  return "Float";
}

/** How a type is written in messages. */
export function typeText(t: KType): string {
  return t === "Boolean" ? "a boolean" : t;
}

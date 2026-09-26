import { describe, expect, it } from "vitest";
import {
  convertConstant,
  foldBinary,
  foldUnary,
  FoldError,
  intConstant,
  numberLiteral,
  numericValue,
  stringConstant,
  type Constant
} from "@main/kbasic/semantics/constants";
import { commonType, literalIntegerType, signedOf, type KType } from "@main/kbasic/semantics/types";
import * as f40 from "@main/kbasic/semantics/float40";

const lit = (n: number, text = String(n)) => numberLiteral(n, text, Number.isInteger(n) ? "integer" : "real");
const typed = (n: number, type: KType): Constant => intConstant(BigInt(n), type);

describe("commonType (spec types.common_type_rule)", () => {
  it.each([
    ["UByte", "UByte", "UByte"],
    ["UByte", "Byte", "Byte"],
    ["UInteger", "Byte", "Integer"],
    ["UByte", "UInteger", "UInteger"],
    ["Integer", "ULong", "Long"],
    ["Long", "Fixed", "Fixed"],
    ["Fixed", "Float", "Float"],
    ["UByte", "Float", "Float"],
    ["Boolean", "Boolean", "UByte"],
    ["Boolean", "Integer", "Integer"],
    ["String", "String", "String"]
  ] as [KType, KType, KType][])("%s with %s is %s", (a, b, expected) => {
    expect(commonType(a, b)).toBe(expected);
    expect(commonType(b, a)).toBe(expected);
  });

  it("has no common type for a String and a number", () => {
    expect(commonType("String", "UByte")).toBeUndefined();
  });

  it("makes unsigned types signed for unary minus", () => {
    expect(signedOf("UByte")).toBe("Byte");
    expect(signedOf("UInteger")).toBe("Integer");
    expect(signedOf("ULong")).toBe("Long");
    expect(signedOf("Float")).toBe("Float");
  });
});

describe("literal types", () => {
  it.each([
    [0, "UByte"],
    [255, "UByte"],
    [256, "UInteger"],
    [65535, "UInteger"],
    [65536, "ULong"],
    [-1, "Byte"],
    [-128, "Byte"],
    [-129, "Integer"],
    [-32769, "Long"],
    [2 ** 32, "Float"]
  ])("%s is %s", (n, t) => {
    expect(literalIntegerType(BigInt(n))).toBe(t);
  });

  it("makes a real literal a Float with the ROM's value", () => {
    const c = numberLiteral(0.1, "0.1", "real");
    expect(c.type).toBe("Float");
    expect(c.value).toEqual({ kind: "float", value: f40.fromDecimal("0.1") });
  });

  it("makes a based literal an integer", () => {
    expect(numberLiteral(255, "$FF", "based")).toMatchObject({ type: "UByte", value: { value: 255n } });
  });
});

describe("convertConstant (spec types.conversions.constants)", () => {
  it("truncates towards minus infinity and reports the lost fraction (W120)", () => {
    expect(convertConstant(lit(3.7, "3.7"), "UByte")).toMatchObject({ constant: { value: { value: 3n } }, lossy: true });
    expect(convertConstant(lit(-3.5, "-3.5"), "Integer")).toMatchObject({ constant: { value: { value: -4n } }, lossy: true });
  });

  it("masks to the width and reports a value that does not fit (W120)", () => {
    expect(convertConstant(lit(300), "UByte")).toMatchObject({ constant: { value: { value: 44n } }, lossy: true });
    expect(convertConstant(lit(200), "Byte")).toMatchObject({ constant: { value: { value: -56n } }, lossy: true });
    expect(convertConstant(lit(-1), "UInteger")).toMatchObject({ constant: { value: { value: 65535n } }, lossy: true });
  });

  it("converts a fitting whole value without loss", () => {
    expect(convertConstant(lit(100), "Byte")).toMatchObject({ constant: { type: "Byte", value: { value: 100n } }, lossy: false });
    expect(convertConstant(lit(2, "2.0"), "Integer")).toMatchObject({ lossy: false });
  });

  it("converts to Fixed as 16.16", () => {
    expect(convertConstant(lit(1.5, "1.5"), "Fixed")).toMatchObject({ constant: { value: { kind: "fixed", raw: 98304 } }, lossy: false });
    expect(convertConstant(lit(40000), "Fixed")).toMatchObject({ lossy: true });
  });

  it("converts to Float exactly for integers", () => {
    const c = convertConstant(lit(70000), "Float")!.constant;
    expect(numericValue(c)).toBe(70000);
  });

  it("keeps an address in a 16-bit or wider type and gives up on a byte", () => {
    const address: Constant = { type: "UInteger", value: { kind: "address", symbol: "label", offset: 0 } };
    expect(convertConstant(address, "Long")?.constant.value).toEqual(address.value);
    expect(convertConstant(address, "UByte")).toBeUndefined();
  });
});

describe("foldBinary", () => {
  it("keeps literal arithmetic exact, typed by the result", () => {
    expect(foldBinary("+", lit(200), lit(100), "UByte", "UByte")).toMatchObject({ type: "UInteger", value: { value: 300n } });
    expect(foldBinary("-", lit(1), lit(2), "UByte", "UByte")).toMatchObject({ type: "Byte", value: { value: -1n } });
  });

  it("wraps typed arithmetic to the type's width", () => {
    expect(foldBinary("+", typed(200, "UByte"), lit(100), "UByte", "UByte")).toMatchObject({ type: "UByte", value: { value: 44n } });
    expect(foldBinary("*", typed(300, "Integer"), typed(300, "Integer"), "Integer", "Integer")).toMatchObject({
      value: { value: BigInt.asIntN(16, 90000n) }
    });
  });

  it("divides integers towards zero, the remainder taking the dividend's sign", () => {
    expect(foldBinary("/", lit(7), lit(2), "UByte", "UByte")?.value).toMatchObject({ value: 3n });
    expect(foldBinary("/", typed(-7, "Byte"), typed(2, "Byte"), "Byte", "Byte")?.value).toMatchObject({ value: -3n });
    expect(foldBinary("MOD", typed(-7, "Byte"), typed(2, "Byte"), "Byte", "Byte")?.value).toMatchObject({ value: -1n });
  });

  it("folds an integer division by zero as the runtime computes it", () => {
    expect(foldBinary("/", typed(7, "UByte"), typed(0, "UByte"), "UByte", "UByte")?.value).toMatchObject({ value: 255n });
    expect(foldBinary("MOD", typed(7, "UByte"), typed(0, "UByte"), "UByte", "UByte")?.value).toMatchObject({ value: 7n });
  });

  it("computes Float operations bit for bit as the ROM does", () => {
    const r = foldBinary("/", lit(1), lit(3, "3.0"), "Float", "Float")!;
    expect(r.value).toEqual({ kind: "float", value: f40.divide(f40.fromInteger(1), f40.fromInteger(3)) });
  });

  it("reports a Float division by zero and an overflow", () => {
    expect(() => foldBinary("/", lit(1.5, "1.5"), lit(0, "0.0"), "Float", "Float")).toThrow(FoldError);
    const big = numberLiteral(1e38, "1e38", "real");
    expect(() => foldBinary("*", big, big, "Float", "Float")).toThrowError(new FoldError("overflow"));
  });

  it("folds Fixed arithmetic in 16.16", () => {
    const a = convertConstant(lit(1.5, "1.5"), "Fixed")!.constant;
    const b = convertConstant(lit(2), "Fixed")!.constant;
    expect(numericValue(foldBinary("*", a, b, "Fixed", "Fixed")!)).toBe(3);
    expect(numericValue(foldBinary("/", a, b, "Fixed", "Fixed")!)).toBe(0.75);
  });

  it("gives comparisons and logical operators a Boolean", () => {
    expect(foldBinary("<", lit(1), lit(2), "UByte", "Boolean")).toMatchObject({ type: "Boolean", value: { value: 1n } });
    expect(foldBinary("AND", lit(3), lit(0), "UByte", "Boolean")).toMatchObject({ type: "Boolean", value: { value: 0n } });
    expect(foldBinary("XOR", lit(3), lit(0), "UByte", "Boolean")).toMatchObject({ value: { value: 1n } });
  });

  it("concatenates and compares strings", () => {
    expect(foldBinary("+", stringConstant("ab"), stringConstant("cd"), "String", "String")?.value).toEqual({ kind: "string", value: "abcd" });
    expect(foldBinary("<", stringConstant("ab"), stringConstant("b"), "String", "Boolean")?.value).toMatchObject({ value: 1n });
  });

  it("keeps bitwise results in the operand type", () => {
    expect(foldBinary("BAND", lit(12), lit(10), "UByte", "UByte")).toMatchObject({ type: "UByte", value: { value: 8n } });
    expect(foldBinary("SHL", typed(1, "UByte"), lit(8), "UByte", "UByte")?.value).toMatchObject({ value: 0n });
    expect(foldBinary("SHR", typed(-8, "Byte"), lit(1), "Byte", "Byte")?.value).toMatchObject({ value: -4n });
  });

  it("offsets an address by a constant and leaves anything else to the program", () => {
    const address: Constant = { type: "UInteger", value: { kind: "address", symbol: "table", offset: 0 } };
    expect(foldBinary("+", address, lit(3), "UInteger", "UInteger")?.value).toEqual({ kind: "address", symbol: "table", offset: 3 });
    expect(foldBinary("*", address, lit(3), "UInteger", "UInteger")).toBeUndefined();
  });
});

describe("foldUnary", () => {
  it("negates a literal into the signed type that holds it", () => {
    expect(foldUnary("-", lit(1), "Byte")).toMatchObject({ type: "Byte", value: { value: -1n }, literal: true });
    expect(foldUnary("-", lit(200), "Byte")).toMatchObject({ type: "Integer", value: { value: -200n } });
  });

  it("wraps a typed negation", () => {
    expect(foldUnary("-", typed(-128, "Byte"), "Byte")?.value).toMatchObject({ value: -128n });
  });

  it("inverts bits and truth", () => {
    expect(foldUnary("BNOT", typed(0, "UByte"), "UByte")?.value).toMatchObject({ value: 255n });
    expect(foldUnary("NOT", lit(5), "Boolean")).toMatchObject({ type: "Boolean", value: { value: 0n } });
  });
});

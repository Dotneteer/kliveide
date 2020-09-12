import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";
import { TokenStream } from "../../src/parser/token-stream";
import { Z80AsmParser } from "../../src/parser/z80-asm-parser";
import { Symbol, ConditionalExpression, BinaryExpression } from "../../src/parser/tree-nodes";

describe("Parser - expression precedence", () => {
  it("parenthesized #1", () => {
    const parser = createParser("(abc)");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "Symbol").toBe(true);
    const symbol = parsed as Symbol;
    expect(symbol.identifier).toBe("abc");
  });

  it("bracketed #1", () => {
    const parser = createParser("[abc]");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "Symbol").toBe(true);
    const symbol = parsed as Symbol;
    expect(symbol.identifier).toBe("abc");
  });

  it("conditional #1", () => {
    const parser = createParser("abc ? d1 : d2");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "ConditionalExpression").toBe(true);
    const cond = parsed as ConditionalExpression;
    expect(cond.condition.type === "Symbol").toBe(true);
    let symbol = cond.condition as Symbol;
    expect(symbol.identifier).toBe("abc");
    expect(cond.consequent.type === "Symbol").toBe(true);
    symbol = cond.consequent as Symbol;
    expect(symbol.identifier).toBe("d1");
    expect(cond.alternate.type === "Symbol").toBe(true);
    symbol = cond.alternate as Symbol;
    expect(symbol.identifier).toBe("d2");
  });

  it("conditional #2", () => {
    const parser = createParser("cond ? b1 | b2 : d2");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "ConditionalExpression").toBe(true);
    const cond = parsed as ConditionalExpression;
    expect(cond.condition.type === "Symbol").toBe(true);
    let symbol = cond.condition as Symbol;
    expect(symbol.identifier).toBe("cond");
    expect(cond.consequent.type === "BinaryExpression").toBe(true);
    let binary = cond.consequent as BinaryExpression;
    expect(binary.operator).toBe("|");
    expect(cond.alternate.type === "Symbol").toBe(true);
    expect(binary.left.type === "Symbol").toBe(true);
    symbol = binary.left as Symbol;
    expect(symbol.identifier).toBe("b1");
    symbol = binary.right as Symbol;
    expect(symbol.identifier).toBe("b2");
    symbol = cond.alternate as Symbol;
    expect(symbol.identifier).toBe("d2");
  });

  it("xor-or #1", () => {
    const parser = createParser("val1 ^ val2 | val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("|")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("^");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("xor-or #2", () => {
    const parser = createParser("val1 | val2 ^ val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("|")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("^");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("and-xor #1", () => {
    const parser = createParser("val1 & val2 ^ val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("^")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("&");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("and-xor #2", () => {
    const parser = createParser("val1 ^ val2 & val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("^")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("&");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("equ-and #1", () => {
    const parser = createParser("val1 == val2 & val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("&")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("==");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("equ-and #2", () => {
    const parser = createParser("val1 & val2 == val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("&")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("==");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("equ-and #3", () => {
    const parser = createParser("val1 === val2 & val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("&")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("===");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("equ-and #4", () => {
    const parser = createParser("val1 & val2 === val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("&")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("===");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("equ-and #5", () => {
    const parser = createParser("val1 != val2 & val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("&")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("!=");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("equ-and #6", () => {
    const parser = createParser("val1 & val2 != val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("&")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("!=");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("equ-and #7", () => {
    const parser = createParser("val1 !== val2 & val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("&")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("!==");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("equ-and #8", () => {
    const parser = createParser("val1 & val2 !== val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("&")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("!==");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("rel-equ #1", () => {
    const parser = createParser("val1 > val2 == val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("==")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe(">");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("rel-equ #2", () => {
    const parser = createParser("val1 == val2 > val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("==")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe(">");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("rel-equ #3", () => {
    const parser = createParser("val1 >= val2 == val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("==")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe(">=");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("rel-equ #4", () => {
    const parser = createParser("val1 == val2 >= val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("==")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe(">=");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("rel-equ #5", () => {
    const parser = createParser("val1 < val2 == val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("==")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("<");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("rel-equ #6", () => {
    const parser = createParser("val1 == val2 < val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("==")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("<");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("rel-equ #7", () => {
    const parser = createParser("val1 <= val2 == val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("==")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("<=");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("rel-equ #8", () => {
    const parser = createParser("val1 == val2 <= val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("==")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("<=");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("shift-rel #1", () => {
    const parser = createParser("val1 << val2 < val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("<")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("<<");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("shift-rel #2", () => {
    const parser = createParser("val1 < val2 << val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("<")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("<<");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("shift-rel #3", () => {
    const parser = createParser("val1 >> val2 < val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("<")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe(">>");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("shift-rel #4", () => {
    const parser = createParser("val1 < val2 >> val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("<")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe(">>");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("add-shift #1", () => {
    const parser = createParser("val1 + val2 >> val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe(">>")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("+");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("add-shift #2", () => {
    const parser = createParser("val1 >> val2 + val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe(">>")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("+");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("add-shift #3", () => {
    const parser = createParser("val1 - val2 >> val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe(">>")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("-");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("add-shift #4", () => {
    const parser = createParser("val1 >> val2 - val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe(">>")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("-");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("mul-add #1", () => {
    const parser = createParser("val1 * val2 + val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("+")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("*");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("mul-add #2", () => {
    const parser = createParser("val1 + val2 * val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("+")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("*");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("mul-add #3", () => {
    const parser = createParser("val1 / val2 + val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("+")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("/");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("mul-add #4", () => {
    const parser = createParser("val1 + val2 / val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("+")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("/");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("mul-add #5", () => {
    const parser = createParser("val1 % val2 + val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("+")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("%");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("mul-add #6", () => {
    const parser = createParser("val1 + val2 % val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("+")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("%");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("minmax-mul #1", () => {
    const parser = createParser("val1 <? val2 * val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("*")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe("<?");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("minmax-mul #2", () => {
    const parser = createParser("val1 * val2 <? val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("*")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe("<?");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

  it("minmax-mul #3", () => {
    const parser = createParser("val1 >? val2 * val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("*")
    expect(expr.left.type === "BinaryExpression").toBe(true);
    const left = expr.left as BinaryExpression;
    expect(left.operator).toBe(">?");
    expect(left.left.type === "Symbol").toBe(true)
    expect(expr.right.type === "Symbol").toBe(true);
    const right = expr.right as Symbol;
  });

  it("minmax-mul #4", () => {
    const parser = createParser("val1 * val2 >? val3");
    const parsed = parser.parseExpr();
    expect(parser.hasErrors).toBe(false);
    expect(parsed).not.toBeNull();
    expect(parsed.type === "BinaryExpression").toBe(true);
    const expr = parsed as BinaryExpression;
    expect(expr.type === "BinaryExpression").toBe(true);
    expect(expr.operator).toBe("*")
    expect(expr.left.type === "Symbol").toBe(true);
    const left = expr.left as Symbol;
    expect(left.type === "Symbol").toBe(true)
    expect(expr.right.type === "BinaryExpression").toBe(true);
    const right = expr.right as BinaryExpression;
    expect(right.operator).toBe(">?");
    expect(right.left.type === "Symbol").toBe(true);
    expect(right.right.type === "Symbol").toBe(true);
  });

});

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

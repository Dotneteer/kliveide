import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";
import { TokenStream } from "../../src/parser/token-stream";
import { Z80AsmParser } from "../../src/parser/z80-asm-parser";
import { Symbol, UnaryExpression } from "../../src/parser/tree-nodes";
import { fail } from "assert";

describe("Parser - unary expressions", () => {
  const unaryOps = ["+", "-", "~", "!"];
  unaryOps.forEach((op) => {
    it(`unary ${op}`, () => {
      testUnary(op);
    });
  });
});

function testUnary(operator: string): void {
  let parser = createParser(operator + "abc");
  let parsed = parser.parseExpr();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.type === "UnaryExpression").toBe(true);
  const unary = parsed as UnaryExpression;
  expect(unary.operator).toBe(operator);
  const { operand } = unary;
  expect(operand.type === "Symbol").toBe(true);
  const symbol = operand as Symbol;
  expect(symbol.identifier).toBe("abc");

  parser = createParser(operator + "de");
  try {
    parser.parseExpr();
    fail("Exception expected");
  } catch {
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors.length).toBe(1);
    expect(parser.errors[0].code === "Z1003").toBe(true);
  }

  parser = createParser(operator + "swapnib");
  try {
    parser.parseExpr();
    fail("Exception expected");
  } catch {
    expect(parser.hasErrors).toBe(true);
    expect(parser.errors.length).toBe(1);
    expect(parser.errors[0].code === "Z1003").toBe(true);
  }
}

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

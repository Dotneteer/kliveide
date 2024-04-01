import "mocha";
import { expect } from "expect";
import { Parser } from "@common/ksx/Parser";
import { Identifier } from "@common/ksx/source-tree";

describe("KSX Parser - primary expressions", () => {
  it("null", () => {
    // --- Arrange
    const wParser = new Parser("null");

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("Literal");
    expect(expr.source).toEqual("null");
  });

  it("undefined", () => {
    // --- Arrange
    const wParser = new Parser("undefined");

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("Literal");
    expect(expr.source).toEqual("undefined");
  });

  const identifierCases = [
    { src: "$id", exp: "$id" },
    { src: "ident", exp: "ident" },
    { src: "_alma$123", exp: "_alma$123" }
  ];

  identifierCases.forEach(c => {
    it(`Identifier: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("Identifier");
      const literal = expr as Identifier;
      expect(literal.name).toEqual(c.exp);
      expect(literal.source).toEqual(c.exp);
    });
  });

  const parenthesizedCases = [
    { src: "(123)", exp: "Literal" },
    { src: "(a+b)", exp: "BinaryExpression" },
    { src: "(a ? b : c)", exp: "ConditionalExpression" },
    { src: "(!a)", exp: "UnaryExpression" },
    { src: "(a)", exp: "Identifier" },
    { src: "(a, b)", exp: "SequenceExpression" },
    { src: "(c(a, b))", exp: "FunctionInvocation" },
    { src: "(a.b)", exp: "MemberAccess" },
    { src: "(a[b])", exp: "CalculatedMemberAccess" }
  ];
  parenthesizedCases.forEach(c => {
    it(`Parenthesized expression: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual(c.exp);
      expect(expr.source).toEqual(c.src);
      expect(expr.parenthesized).toEqual(1);
    });
  });
});

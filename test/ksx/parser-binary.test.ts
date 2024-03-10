import "mocha";
import { expect } from "expect";
import { Parser } from "@main/ksx/Parser";
import { BinaryExpression } from "@main/ksx/source-tree";

describe("KSX Parser - Binary operations", () => {
  const binaryOpCases = [
    { src: "a**b", op: "**" },
    { src: "a+b", op: "+" },
    { src: "a-b", op: "-" },
    { src: "a*b", op: "*" },
    { src: "a/b", op: "/" },
    { src: "a%b", op: "%" },
    { src: "a>>b", op: ">>" },
    { src: "a<<b", op: "<<" },
    { src: "a>>>b", op: ">>>" },
    { src: "a == b", op: "==" },
    { src: "a != b", op: "!=" },
    { src: "a < b", op: "<" },
    { src: "a <= b", op: "<=" },
    { src: "a>b", op: ">" },
    { src: "a>=b", op: ">=" },
    { src: "a ?? b", op: "??" },
    { src: "a | b", op: "|" },
    { src: "a & b", op: "&" },
    { src: "a ^ b", op: "^" },
    { src: "a || b", op: "||" },
    { src: "a && b", op: "&&" },
    { src: "a in b", op: "in" }
  ];
  binaryOpCases.forEach(c => {
    it(`Binary (operator): ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("BinaryExpression");
      const binary = expr as BinaryExpression;
      expect(binary.operator).toEqual(c.op);
      expect(binary.source).toEqual(c.src);
    });
  });

  const binaryLeftOperandCases = [
    { src: "a+b", op: "+", exp: "Identifier" },
    { src: "a+(b+c)", op: "+", exp: "Identifier" },
    { src: "a+b+c", op: "+", exp: "BinaryExpression" },
    { src: "a+b*c", op: "+", exp: "Identifier" },
    { src: "!a+b", op: "+", exp: "UnaryExpression" },
    { src: "a.c+b", op: "+", exp: "MemberAccess" },
    { src: "a[c]+b", op: "+", exp: "CalculatedMemberAccess" },
    { src: "(a ? b : c)+b", op: "+", exp: "ConditionalExpression" },
    { src: "123+b", op: "+", exp: "Literal" },
    { src: "a(b,c)+b", op: "+", exp: "FunctionInvocation" },
    { src: "(123, 1+c)+b", op: "+", exp: "SequenceExpression" }
  ];
  binaryLeftOperandCases.forEach(c => {
    it(`Binary (left operand): ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("BinaryExpression");
      const binary = expr as BinaryExpression;
      expect(binary.operator).toEqual(c.op);
      expect(binary.left.type).toEqual(c.exp);
      expect(binary.source).toEqual(c.src);
    });
  });

  const binaryRightOperandCases = [
    { src: "a+b", op: "+", exp: "Identifier" },
    { src: "a+(b+c)", op: "+", exp: "BinaryExpression" },
    { src: "a+b+c", op: "+", exp: "Identifier" },
    { src: "a+b*c", op: "+", exp: "BinaryExpression" },
    { src: "a*b+c", op: "+", exp: "Identifier" },
    { src: "a+!b", op: "+", exp: "UnaryExpression" },
    { src: "a+b.c", op: "+", exp: "MemberAccess" },
    { src: "a+b[c]", op: "+", exp: "CalculatedMemberAccess" },
    { src: "a +(a ? b : c)", op: "+", exp: "ConditionalExpression" },
    { src: "b+123", op: "+", exp: "Literal" },
    { src: "b+a(b,c)", op: "+", exp: "FunctionInvocation" },
    { src: "b+(123, 1+c)", op: "+", exp: "SequenceExpression" }
  ];
  binaryRightOperandCases.forEach(c => {
    it(`Binary (left operand): ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("BinaryExpression");
      const binary = expr as BinaryExpression;
      expect(binary.operator).toEqual(c.op);
      expect(binary.right.type).toEqual(c.exp);
      expect(binary.source).toEqual(c.src);
    });
  });
});

import "mocha";
import { expect } from "expect";
import { Parser } from "@common/ksx/Parser";
import {
  FunctionInvocationExpression,
  MemberAccessExpression,
  PostfixOpExpression,
  PrefixOpExpression,
  SequenceExpression,
  SpreadExpression
} from "@common/ksx/source-tree";

describe("KSX Parser - miscellaneous expressions", () => {
  const sequenceCases = [
    { src: "a, b, a+b", len: 3, idx: 0, exp: "Identifier" },
    { src: "a, b, a+b", len: 3, idx: 1, exp: "Identifier" },
    { src: "a, b, a+b", len: 3, idx: 2, exp: "BinaryExpression" },
    { src: "a(b), b.a, a[b], !a", len: 4, idx: 0, exp: "FunctionInvocation" },
    { src: "a(b), b.a, a[b], !a", len: 4, idx: 1, exp: "MemberAccess" },
    {
      src: "a(b), b.a, a[b], !a",
      len: 4,
      idx: 2,
      exp: "CalculatedMemberAccess"
    },
    { src: "a(b), b.a, a[b], !a", len: 4, idx: 3, exp: "UnaryExpression" },
    { src: 'a, 12.3, "Hello"', len: 3, idx: 1, exp: "Literal" },
    { src: 'a, 12.3, "Hello"', len: 3, idx: 2, exp: "Literal" }
  ];
  sequenceCases.forEach(c => {
    it(`Sequence expression: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("SequenceExpression");
      const sequence = expr as SequenceExpression;
      expect(sequence.expressions.length).toEqual(c.len);
      expect(sequence.expressions[c.idx].type).toEqual(c.exp);
      expect(sequence.source).toEqual(c.src);
    });
  });

  const invocationCases = [
    { src: "func()", len: 0, idx: -1, exp: null },
    { src: "func(a, b)", len: 2, idx: 0, exp: "Identifier" },
    { src: "func(a, b)", len: 2, idx: 1, exp: "Identifier" },
    { src: "func(123, a+b, a[b])", len: 3, idx: 0, exp: "Literal" },
    { src: "func(123, a+b, a[b])", len: 3, idx: 1, exp: "BinaryExpression" },
    {
      src: "func(123, a+b, a[b])",
      len: 3,
      idx: 2,
      exp: "CalculatedMemberAccess"
    }
  ];
  invocationCases.forEach(c => {
    it(`FunctionInvocation: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("FunctionInvocation");
      const invocation = expr as FunctionInvocationExpression;
      expect(invocation.object.type).toEqual("Identifier");
      expect(invocation.arguments.length).toEqual(c.len);
      if (c.len > 0) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(invocation.arguments[c.idx].type).toEqual(c.exp);
      }
      expect(invocation.source).toEqual(c.src);
    });
  });

  const objectCases = [
    { src: "func()", exp: "Identifier" },
    { src: "(+a)()", exp: "UnaryExpression" },
    { src: "(a+b)()", exp: "BinaryExpression" },
    { src: "(a ? b : c)()", exp: "ConditionalExpression" },
    { src: "(123)()", exp: "Literal" },
    { src: '("Hello")()', exp: "Literal" },
    { src: "(func(a, b))()", exp: "FunctionInvocation" },
    { src: "(a.b)()", exp: "MemberAccess" },
    { src: "(a[b])()", exp: "CalculatedMemberAccess" }
  ];
  objectCases.forEach(c => {
    it(`FunctionInvocation object: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("FunctionInvocation");
      const invocation = expr as FunctionInvocationExpression;
      expect(invocation.object.type).toEqual(c.exp);
      expect(invocation.source).toEqual(c.src);
    });
  });

  const memberAccessCases = [
    { src: "a.b", exp: "Identifier" },
    { src: "(+a).b", exp: "UnaryExpression" },
    { src: "(a+b).b", exp: "BinaryExpression" },
    { src: "(a ? b : c).b", exp: "ConditionalExpression" },
    { src: "(123).b", exp: "Literal" },
    { src: '("Hello").b', exp: "Literal" },
    { src: "(func(a, b)).b", exp: "FunctionInvocation" },
    { src: "(a.b).b", exp: "MemberAccess" },
    { src: "(a[b]).b", exp: "CalculatedMemberAccess" }
  ];
  memberAccessCases.forEach(c => {
    it(`MemberAccess: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("MemberAccess");
      const memberAcc = expr as MemberAccessExpression;
      expect(memberAcc.member).toEqual("b");
      expect(memberAcc.object.type).toEqual(c.exp);
      expect(memberAcc.source).toEqual(c.src);
    });
  });

  const spreadCases = [
    { src: "...[1, 2, 3]", exp: "ArrayLiteral" },
    { src: "...apple", exp: "Identifier" }
  ];
  spreadCases.forEach(c => {
    it(`Spread: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("SpreadExpression");
      const spread = expr as SpreadExpression;
      expect(spread.operand.type).toEqual(c.exp);
      expect(spread.source).toEqual(c.src);
    });
  });

  const prefixCases = [
    { src: "++i", op: "++", exp: "Identifier" },
    { src: "++j[2]", op: "++", exp: "CalculatedMemberAccess" },
    { src: "--i", op: "--", exp: "Identifier" },
    { src: "--j[2]", op: "--", exp: "CalculatedMemberAccess" }
  ];
  prefixCases.forEach(c => {
    it(`Prefix: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("PrefixOpExpression");
      const prefixExpr = expr as PrefixOpExpression;
      expect(prefixExpr.operand.type).toEqual(c.exp);
      expect(prefixExpr.operator).toEqual(c.op);
      expect(prefixExpr.source).toEqual(c.src);
    });
  });

  const postfixCases = [
    { src: "i++", op: "++", exp: "Identifier" },
    { src: "j[2]++", op: "++", exp: "CalculatedMemberAccess" },
    { src: "i--", op: "--", exp: "Identifier" },
    { src: "j[2]--", op: "--", exp: "CalculatedMemberAccess" }
  ];
  postfixCases.forEach(c => {
    it(`Postfix: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("PostfixOpExpression");
      const postfixExpr = expr as PostfixOpExpression;
      expect(postfixExpr.operand.type).toEqual(c.exp);
      expect(postfixExpr.operator).toEqual(c.op);
      expect(postfixExpr.source).toEqual(c.src);
    });
  });
});

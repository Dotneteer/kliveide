import "mocha";
import { expect } from "expect";
import { Parser } from "@main/ksx/Parser";
import { UnaryExpression } from "@main/ksx/source-tree";

describe("KSX - Parser - unary expressions", () => {
  const unaryCases = [
    { src: "+a", op: "+", exp: "Identifier" },
    { src: "-a", op: "-", exp: "Identifier" },
    { src: "!a", op: "!", exp: "Identifier" },
    { src: "~a", op: "~", exp: "Identifier" },
    { src: "typeof a", op: "typeof", exp: "Identifier" },
    { src: "delete a", op: "delete", exp: "Identifier" },

    { src: "+3", op: "+", exp: "Literal" },
    { src: "-3.14", op: "-", exp: "Literal" },
    { src: "!0b1111", op: "!", exp: "Literal" },
    { src: "~0xa123", op: "~", exp: "Literal" },
    { src: 'typeof "abc"', op: "typeof", exp: "Literal" },
    { src: 'delete "abc"', op: "delete", exp: "Literal" },

    { src: "+!a", op: "+", exp: "UnaryExpression" },
    { src: "-!a", op: "-", exp: "UnaryExpression" },
    { src: "!!a", op: "!", exp: "UnaryExpression" },
    { src: "~!a", op: "~", exp: "UnaryExpression" },
    { src: "typeof !a", op: "typeof", exp: "UnaryExpression" },
    { src: "delete !a", op: "delete", exp: "UnaryExpression" },

    { src: "+(a+b)", op: "+", exp: "BinaryExpression" },
    { src: "-(a+b)", op: "-", exp: "BinaryExpression" },
    { src: "!(a+b)", op: "!", exp: "BinaryExpression" },
    { src: "~(a+b)", op: "~", exp: "BinaryExpression" },
    { src: "typeof (a+b)", op: "typeof", exp: "BinaryExpression" },
    { src: "delete (a+b)", op: "delete", exp: "BinaryExpression" },

    { src: "+(a, b)", op: "+", exp: "SequenceExpression" },
    { src: "-(a, b)", op: "-", exp: "SequenceExpression" },
    { src: "!(a, b)", op: "!", exp: "SequenceExpression" },
    { src: "~(a, b)", op: "~", exp: "SequenceExpression" },
    { src: "typeof (a, b)", op: "typeof", exp: "SequenceExpression" },
    { src: "delete (a, b)", op: "delete", exp: "SequenceExpression" },

    { src: "+(a ? b : c)", op: "+", exp: "ConditionalExpression" },
    { src: "-(a ? b : c)", op: "-", exp: "ConditionalExpression" },
    { src: "!(a ? b : c)", op: "!", exp: "ConditionalExpression" },
    { src: "~(a ? b : c)", op: "~", exp: "ConditionalExpression" },
    { src: "typeof (a ? b : c)", op: "typeof", exp: "ConditionalExpression" },
    { src: "delete (a ? b : c)", op: "delete", exp: "ConditionalExpression" },

    { src: "+c(a, b)", op: "+", exp: "FunctionInvocation" },
    { src: "-c(a, b)", op: "-", exp: "FunctionInvocation" },
    { src: "!c(a, b)", op: "!", exp: "FunctionInvocation" },
    { src: "~c(a, b)", op: "~", exp: "FunctionInvocation" },
    { src: "typeof c(a, b)", op: "typeof", exp: "FunctionInvocation" },
    { src: "delete c(a, b)", op: "delete", exp: "FunctionInvocation" },

    { src: "+a.b", op: "+", exp: "MemberAccess" },
    { src: "-a.b", op: "-", exp: "MemberAccess" },
    { src: "!a.b", op: "!", exp: "MemberAccess" },
    { src: "~a.b", op: "~", exp: "MemberAccess" },
    { src: "typeof a.b", op: "typeof", exp: "MemberAccess" },
    { src: "delete a.b", op: "delete", exp: "MemberAccess" },

    { src: "+a[b]", op: "+", exp: "CalculatedMemberAccess" },
    { src: "-a[b]", op: "-", exp: "CalculatedMemberAccess" },
    { src: "!a[b]", op: "!", exp: "CalculatedMemberAccess" },
    { src: "~a[b]", op: "~", exp: "CalculatedMemberAccess" },
    { src: "typeof a[b]", op: "typeof", exp: "CalculatedMemberAccess" },
    { src: "delete a[b]", op: "delete", exp: "CalculatedMemberAccess" }
  ];
  unaryCases.forEach(c => {
    it(`Unary: ${c.src}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      const expr = wParser.parseExpr();

      // --- Assert
      expect(expr).not.toEqual(null);
      if (!expr) return;
      expect(expr.type).toEqual("UnaryExpression");
      const unary = expr as UnaryExpression;
      expect(unary.operator).toEqual(c.op);
      expect(unary.operand.type).toEqual(c.exp);
      expect(unary.source).toEqual(c.src);
    });
  });
});

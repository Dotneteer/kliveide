import "mocha";
import { expect } from "expect";
import { Parser } from "@common/ksx/Parser";
import { AssignmentExpression, BinaryExpression } from "@common/ksx/source-tree";

describe("KSX Parser - assignment expressions", () => {
  it("Assignment with binary expression", () => {
    // --- Arrange
    const wParser = new Parser("a = 2 + c");

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("AssignmentExpression");
    const asgn = expr as AssignmentExpression;
    expect(asgn.leftValue.type).toEqual("Identifier");
    expect(asgn.operand.type).toEqual("BinaryExpression");
    const bExpr = asgn.operand as BinaryExpression;
    expect(bExpr.left.type).toEqual("Literal");
    expect(bExpr.right.type).toEqual("Identifier");
  });
});

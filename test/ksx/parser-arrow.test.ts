import "mocha";
import { expect } from "expect";
import assert from "assert";
import { Parser } from "@main/ksx/Parser";
import {
  ArrowExpression,
  BlockStatement,
  Destructure,
  FunctionInvocationExpression,
  Identifier
} from "@main/ksx/source-tree";

describe("KSX Parser - arrow expressions", () => {
  it("No param", () => {
    // --- Arrange
    const source = "() => 2*v";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(0);
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Single param", () => {
    // --- Arrange
    const source = "v => 2*v";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(1);
    expect((arrowExpr.args[0] as Identifier).name).toEqual("v");
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Single (param)", () => {
    // --- Arrange
    const source = "(v) => 2*v";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(1);
    expect((arrowExpr.args[0] as Identifier).name).toEqual("v");
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  const invalidLeftCases = [
    "2 => 2*v",
    "a+2 => 2*v",
    "(a, a+2) => 2*v",
    "(a+2) => 2*v",
    "(!a) => 2*v",
    "((a)) => 2*v"
  ];
  invalidLeftCases.forEach(c => {
    it(`Invalid param: '${c}' `, () => {
      // --- Arrange
      const wParser = new Parser(c);

      // --- Act/Assert
      try {
        wParser.parseExpr();
      } catch (err) {
        expect(err.toString()).toContain("Invalid");
        return;
      }
      assert.fail("Exception expected");
    });
  });

  it("multiple params", () => {
    // --- Arrange
    const source = "(v, w) => 2*v + w";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(2);
    expect((arrowExpr.args[0] as Identifier).name).toEqual("v");
    expect((arrowExpr.args[1] as Identifier).name).toEqual("w");
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Block statement #1", () => {
    // --- Arrange
    const source = "(v, w) => { 2*v + w }";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(2);
    expect((arrowExpr.args[0] as Identifier).name).toEqual("v");
    expect((arrowExpr.args[1] as Identifier).name).toEqual("w");
    expect(arrowExpr.statement.type).toEqual("BlockStatement");
    const stmts = arrowExpr.statement as BlockStatement;
    expect(stmts.statements.length).toEqual(1);
    expect(stmts.statements[0].type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Block statement #2", () => {
    // --- Arrange
    const source = "(v, w) => { let x = 3; 2*v + w + x }";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(2);
    expect((arrowExpr.args[0] as Identifier).name).toEqual("v");
    expect((arrowExpr.args[1] as Identifier).name).toEqual("w");
    expect(arrowExpr.statement.type).toEqual("BlockStatement");
    const stmts = arrowExpr.statement as BlockStatement;
    expect(stmts.statements.length).toEqual(2);
    expect(stmts.statements[0].type).toEqual("LetStatement");
    expect(stmts.statements[1].type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Block statement #3", () => {
    // --- Arrange
    const source = "() => { Action.somethings() }";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(0);
    expect(arrowExpr.statement.type).toEqual("BlockStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Block statement #4", () => {
    // --- Arrange
    const source =
      "(item) => { \n" +
      "  Actions.DeleteEntityAction({\n" +
      '    entityId: "apiFile",\n' +
      "    entityDisplayName: item,\n" +
      "    params: {\n" +
      "      nodeId: #props.nodeId,\n" +
      "      id: item\n" +
      "    }\n" +
      "  })\n" +
      "}";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(1);
    expect(arrowExpr.statement.type).toEqual("BlockStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Arrow function invocation #1", () => {
    // --- Arrange
    const source = "(() => 2*v)()";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("FunctionInvocation");
    const funcExpr = expr as FunctionInvocationExpression;
    expect(funcExpr.arguments.length).toEqual(0);
    expect(funcExpr.object.type).toEqual("ArrowExpression");
    expect(funcExpr.source).toEqual(source);
  });

  it("Arrow function invocation #2", () => {
    // --- Arrange
    const source = "((x, y) => x + y)(12, 23)";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("FunctionInvocation");
    const funcExpr = expr as FunctionInvocationExpression;
    expect(funcExpr.arguments.length).toEqual(2);
    expect(funcExpr.object.type).toEqual("ArrowExpression");
    expect(funcExpr.source).toEqual(source);
  });

  it("Arrow function invocation #2", () => {
    // --- Arrange
    const source = "((x, y) => x + y)(12, 23)";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("FunctionInvocation");
    const funcExpr = expr as FunctionInvocationExpression;
    expect(funcExpr.arguments.length).toEqual(2);
    expect(funcExpr.object.type).toEqual("ArrowExpression");
    expect(funcExpr.source).toEqual(source);
  });

  it("Single object destructure #1", () => {
    // --- Arrange
    const source = "({x, y}) => x + y";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(1);
    expect((arrowExpr.args[0] as Destructure).objectDestruct[0].id).toEqual(
      "x"
    );
    expect((arrowExpr.args[0] as Destructure).objectDestruct[1].id).toEqual(
      "y"
    );
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Single object destructure #2", () => {
    // --- Arrange
    const source = "({x, y:q}) => x + q";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(1);
    expect((arrowExpr.args[0] as Destructure).objectDestruct[0].id).toEqual(
      "x"
    );
    expect((arrowExpr.args[0] as Destructure).objectDestruct[1].id).toEqual(
      "y"
    );
    expect((arrowExpr.args[0] as Destructure).objectDestruct[1].alias).toEqual(
      "q"
    );
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Single object destructure #3", () => {
    // --- Arrange
    const source = "({x, y: {v, w}}) => 3";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(1);
    expect((arrowExpr.args[0] as Destructure).objectDestruct[0].id).toEqual(
      "x"
    );
    expect(
      (arrowExpr.args[0] as Destructure).objectDestruct[1].objectDestruct[0].id
    ).toEqual("v");
    expect(
      (arrowExpr.args[0] as Destructure).objectDestruct[1].objectDestruct[1].id
    ).toEqual("w");
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Single array destructure #1", () => {
    // --- Arrange
    const source = "([x, y]) => x + y";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(1);
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[0].id).toEqual("x");
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[1].id).toEqual("y");
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Single array destructure #2", () => {
    // --- Arrange
    const source = "([x,, y]) => x + y";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(1);
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[0].id).toEqual("x");
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[1].id).toEqual(
      undefined
    );
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[2].id).toEqual("y");
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Complex destructure #1", () => {
    // --- Arrange
    const source = "([a,, b], {c, y:d}) => 1";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(2);
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[0].id).toEqual("a");
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[1].id).toEqual(
      undefined
    );
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[2].id).toEqual("b");
    expect((arrowExpr.args[1] as Destructure).objectDestruct[0].id).toEqual(
      "c"
    );
    expect((arrowExpr.args[1] as Destructure).objectDestruct[1].id).toEqual(
      "y"
    );
    expect((arrowExpr.args[1] as Destructure).objectDestruct[1].alias).toEqual(
      "d"
    );
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });

  it("Complex destructure #2", () => {
    // --- Arrange
    const source = "([a,, b], {c, y:d}, e) => 1";
    const wParser = new Parser(source);

    // --- Act
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr).not.toEqual(null);
    if (!expr) return;
    expect(expr.type).toEqual("ArrowExpression");
    const arrowExpr = expr as ArrowExpression;
    expect(arrowExpr.args.length).toEqual(3);
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[0].id).toEqual("a");
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[1].id).toEqual(
      undefined
    );
    expect((arrowExpr.args[0] as Destructure).arrayDestruct[2].id).toEqual("b");
    expect((arrowExpr.args[1] as Destructure).objectDestruct[0].id).toEqual(
      "c"
    );
    expect((arrowExpr.args[1] as Destructure).objectDestruct[1].id).toEqual(
      "y"
    );
    expect((arrowExpr.args[2] as Identifier).name).toEqual("e");
    expect(arrowExpr.statement.type).toEqual("ExpressionStatement");
    expect(arrowExpr.source).toEqual(source);
  });
});

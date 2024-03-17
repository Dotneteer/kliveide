import "mocha";
import { expect } from "expect";
import assert from "assert";
import { Parser } from "@main/ksx/Parser";
import {
  BlockStatement,
  ConstStatement,
  DoWhileStatement,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  IfStatement,
  LetStatement,
  ReturnStatement,
  SwitchStatement,
  ThrowStatement,
  TryStatement,
  WhileStatement
} from "@main/ksx/source-tree";

describe("KSX Parser - statements", () => {
  it("Empty source", () => {
    // --- Arrange
    const wParser = new Parser("");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts?.length).toEqual(0);
  });

  it("Empty statement", () => {
    // --- Arrange
    const wParser = new Parser(";");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("EmptyStatement");
  });

  it("Multiple empty statement", () => {
    // --- Arrange
    const wParser = new Parser(";;");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(2);
    expect(stmts[0].type).toEqual("EmptyStatement");
    expect(stmts[1].type).toEqual("EmptyStatement");
  });

  const exprStmts = [
    { expr: "(a + b)", top: "BinaryExpression" },
    { expr: "myId", top: "Identifier" },
    { expr: "+myId", top: "UnaryExpression" },
    { expr: "-myId", top: "UnaryExpression" },
    { expr: "~myId", top: "UnaryExpression" },
    { expr: "[1, 2, 3]", top: "ArrayLiteral" },
    { expr: "!myId", top: "UnaryExpression" },
    { expr: "...[1, 2, 3]", top: "SpreadExpression" },
    { expr: "123", top: "Literal" },
    { expr: "0x123", top: "Literal" },
    { expr: "0b00_11", top: "Literal" },
    { expr: "true", top: "Literal" },
    { expr: "false", top: "Literal" },
    { expr: "Infinity", top: "Literal" },
    { expr: "typeof a", top: "UnaryExpression" },
    { expr: "#item", top: "Identifier" },
    { expr: "null", top: "Literal" },
    { expr: "undefined", top: "Literal" }
  ];
  exprStmts.forEach((st, idx) => {
    it(`Statement #${idx + 1}: ${st.expr}`, () => {
      // --- Arrange
      const wParser = new Parser(st.expr);

      // --- Act
      const stmts = wParser.parseStatements();

      // --- Assert
      expect(stmts?.length).toEqual(1);
      expect(stmts?.[0].type).toEqual("ExpressionStatement");
      const exprStmt = stmts?.[0] as ExpressionStatement;
      expect(exprStmt.expression.type).toEqual(st.top);
    });
  });

  it("Let statement - no init", () => {
    // --- Arrange
    const wParser = new Parser("let x");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("LetStatement");
    const letStmt = stmts[0] as LetStatement;
    expect(letStmt.declarations.length).toEqual(1);
    expect(letStmt.declarations[0].id).toEqual("x");
    expect(letStmt.declarations[0].expression).toEqual(undefined);
  });

  it("Let statement - with init", () => {
    // --- Arrange
    const wParser = new Parser("let x = 3");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("LetStatement");
    const letStmt = stmts[0] as LetStatement;
    expect(letStmt.declarations.length).toEqual(1);
    expect(letStmt.declarations[0].id).toEqual("x");
    expect(letStmt.declarations[0].expression).not.toEqual(null);
    expect(letStmt.declarations[0].expression!.type).toEqual("Literal");
  });

  it("Const statement", () => {
    // --- Arrange
    const wParser = new Parser("const x = 3");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ConstStatement");
    const constStmt = stmts[0] as ConstStatement;
    expect(constStmt.declarations.length).toEqual(1);
    expect(constStmt.declarations[0].id).toEqual("x");
    expect(constStmt.declarations[0].expression).not.toEqual(null);
    expect(constStmt.declarations[0].expression!.type).toEqual("Literal");
  });

  it("Block statement - empty", () => {
    // --- Arrange
    const wParser = new Parser("{}");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("BlockStatement");
    const blockStmt = stmts[0] as BlockStatement;
    expect(blockStmt.statements.length).toEqual(0);
  });

  it("Block statement - single #1", () => {
    // --- Arrange
    const wParser = new Parser("{;}");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("BlockStatement");
    const blockStmt = stmts[0] as BlockStatement;
    expect(blockStmt.statements.length).toEqual(1);
    expect(blockStmt.statements[0].type).toEqual("EmptyStatement");
  });

  it("Block statement - single #1", () => {
    // --- Arrange
    const wParser = new Parser("{ x; }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("BlockStatement");
    const blockStmt = stmts[0] as BlockStatement;
    expect(blockStmt.statements.length).toEqual(1);
    expect(blockStmt.statements[0].type).toEqual("ExpressionStatement");
  });

  it("Block statement - single #2", () => {
    // --- Arrange
    const wParser = new Parser("{ let x }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("BlockStatement");
    const blockStmt = stmts[0] as BlockStatement;
    expect(blockStmt.statements.length).toEqual(1);
    expect(blockStmt.statements[0].type).toEqual("LetStatement");
  });

  it("Block statement - multiple #1", () => {
    // --- Arrange
    const wParser = new Parser("{ x; let y; }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("BlockStatement");
    const blockStmt = stmts[0] as BlockStatement;
    expect(blockStmt.statements.length).toEqual(2);
    expect(blockStmt.statements[0].type).toEqual("ExpressionStatement");
    expect(blockStmt.statements[1].type).toEqual("LetStatement");
  });

  it("Block statement - multiple #2", () => {
    // --- Arrange
    const wParser = new Parser("{ x; { let y; z} }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("BlockStatement");
    const blockStmt = stmts[0] as BlockStatement;
    expect(blockStmt.statements.length).toEqual(2);
    expect(blockStmt.statements[0].type).toEqual("ExpressionStatement");
    expect(blockStmt.statements[1].type).toEqual("BlockStatement");
    const nested = blockStmt.statements[1] as BlockStatement;
    expect(nested.statements.length).toEqual(2);
    expect(nested.statements[0].type).toEqual("LetStatement");
    expect(nested.statements[1].type).toEqual("ExpressionStatement");
  });

  it("If statement - single then no else", () => {
    // --- Arrange
    const wParser = new Parser("if (true) x;");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("IfStatement");
    const blockStmt = stmts[0] as IfStatement;
    expect(blockStmt.condition.type).toEqual("Literal");
    expect(blockStmt.thenBranch.type).toEqual("ExpressionStatement");
    expect(blockStmt.elseBranch).toEqual(null);
  });

  it("If statement - block then no else", () => {
    // --- Arrange
    const wParser = new Parser("if (true) {x; let y }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("IfStatement");
    const blockStmt = stmts[0] as IfStatement;
    expect(blockStmt.condition.type).toEqual("Literal");
    expect(blockStmt.thenBranch.type).toEqual("BlockStatement");
    expect(blockStmt.elseBranch).toEqual(null);
  });

  it("If statement - block then single else", () => {
    // --- Arrange
    const wParser = new Parser("if (true) {x; let y } else z");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("IfStatement");
    const blockStmt = stmts[0] as IfStatement;
    expect(blockStmt.condition.type).toEqual("Literal");
    expect(blockStmt.thenBranch.type).toEqual("BlockStatement");
    expect(blockStmt.elseBranch!.type).toEqual("ExpressionStatement");
  });

  it("If statement - block then block else", () => {
    // --- Arrange
    const wParser = new Parser("if (true) {x; let y } else { let z; y = 12; }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("IfStatement");
    const blockStmt = stmts[0] as IfStatement;
    expect(blockStmt.condition.type).toEqual("Literal");
    expect(blockStmt.thenBranch.type).toEqual("BlockStatement");
    expect(blockStmt.elseBranch!.type).toEqual("BlockStatement");
  });

  it("If statement - single then block else", () => {
    // --- Arrange
    const wParser = new Parser("if (true) y=13; else { let z; y = 12; }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("IfStatement");
    const blockStmt = stmts[0] as IfStatement;
    expect(blockStmt.condition.type).toEqual("Literal");
    expect(blockStmt.thenBranch.type).toEqual("ExpressionStatement");
    expect(blockStmt.elseBranch!.type).toEqual("BlockStatement");
  });

  it("If statement - single then single else", () => {
    // --- Arrange
    const wParser = new Parser("if (true) y=13; else y = 12;");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("IfStatement");
    const blockStmt = stmts[0] as IfStatement;
    expect(blockStmt.condition.type).toEqual("Literal");
    expect(blockStmt.thenBranch.type).toEqual("ExpressionStatement");
    expect(blockStmt.elseBranch!.type).toEqual("ExpressionStatement");
  });

  it("Return statement - no expression", () => {
    // --- Arrange
    const wParser = new Parser("return");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ReturnStatement");
    const returnStmt = stmts[0] as ReturnStatement;
    expect(returnStmt.expression).toEqual(undefined);
  });

  it("Return statement - with expression", () => {
    // --- Arrange
    const wParser = new Parser("return 123;");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ReturnStatement");
    const returnStmt = stmts[0] as ReturnStatement;
    expect(returnStmt.expression!.type).toEqual("Literal");
  });

  it("Break statement", () => {
    // --- Arrange
    const wParser = new Parser("break;");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("BreakStatement");
  });

  it("Continue statement", () => {
    // --- Arrange
    const wParser = new Parser("continue;");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ContinueStatement");
  });

  it("while statement - empty body", () => {
    // --- Arrange
    const wParser = new Parser("while (a > b);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("WhileStatement");
    const whileStmt = stmts[0] as WhileStatement;
    expect(whileStmt.condition.type).toEqual("BinaryExpression");
    expect(whileStmt.body.type).toEqual("EmptyStatement");
  });

  it("while statement - single statement body", () => {
    // --- Arrange
    const wParser = new Parser("while (a > b) break;");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("WhileStatement");
    const whileStmt = stmts[0] as WhileStatement;
    expect(whileStmt.condition.type).toEqual("BinaryExpression");
    expect(whileStmt.body.type).toEqual("BreakStatement");
  });

  it("while statement - block body", () => {
    // --- Arrange
    const wParser = new Parser("while (a > b) { let x = 1; break; }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("WhileStatement");
    const whileStmt = stmts[0] as WhileStatement;
    expect(whileStmt.condition.type).toEqual("BinaryExpression");
    expect(whileStmt.body.type).toEqual("BlockStatement");
    const blockStmt = whileStmt.body as BlockStatement;
    expect(blockStmt.statements.length).toEqual(2);
    expect(blockStmt.statements[0].type).toEqual("LetStatement");
    expect(blockStmt.statements[1].type).toEqual("BreakStatement");
  });

  it("do-while statement - empty body", () => {
    // --- Arrange
    const wParser = new Parser("do ; while (a > b);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("DoWhileStatement");
    const whileStmt = stmts[0] as DoWhileStatement;
    expect(whileStmt.condition.type).toEqual("BinaryExpression");
    expect(whileStmt.body.type).toEqual("EmptyStatement");
  });

  it("do-while statement - single statement body", () => {
    // --- Arrange
    const wParser = new Parser("do break; while (a > b)");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("DoWhileStatement");
    const whileStmt = stmts[0] as DoWhileStatement;
    expect(whileStmt.condition.type).toEqual("BinaryExpression");
    expect(whileStmt.body.type).toEqual("BreakStatement");
  });

  it("do-while statement - block body", () => {
    // --- Arrange
    const wParser = new Parser("do { let x = 1; break; } while (a > b)");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("DoWhileStatement");
    const whileStmt = stmts[0] as DoWhileStatement;
    expect(whileStmt.condition.type).toEqual("BinaryExpression");
    expect(whileStmt.body.type).toEqual("BlockStatement");
    const blockStmt = whileStmt.body as BlockStatement;
    expect(blockStmt.statements.length).toEqual(2);
    expect(blockStmt.statements[0].type).toEqual("LetStatement");
    expect(blockStmt.statements[1].type).toEqual("BreakStatement");
  });

  it("for loop - no declaration, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (;;);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForStatement");
    const forStmt = stmts[0] as ForStatement;
    expect(forStmt.init).toEqual(undefined);
    expect(forStmt.condition).toEqual(undefined);
    expect(forStmt.update).toEqual(undefined);
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for loop - no init, no condition, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (;; x++);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForStatement");
    const forStmt = stmts[0] as ForStatement;
    expect(forStmt.init).toEqual(undefined);
    expect(forStmt.condition).toEqual(undefined);
    expect(forStmt.update!.type).toEqual("PostfixOpExpression");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for loop - no init, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (; x < 3; x++);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForStatement");
    const forStmt = stmts[0] as ForStatement;
    expect(forStmt.init).toEqual(undefined);
    expect(forStmt.condition!.type).toEqual("BinaryExpression");
    expect(forStmt.update!.type).toEqual("PostfixOpExpression");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for loop - expr init, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (x = 0; x < 3; x++);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForStatement");
    const forStmt = stmts[0] as ForStatement;
    expect(forStmt.init!.type).toEqual("ExpressionStatement");
    expect(forStmt.condition!.type).toEqual("BinaryExpression");
    expect(forStmt.update!.type).toEqual("PostfixOpExpression");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for loop - let init, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (let x = 0; x < 3; x++);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForStatement");
    const forStmt = stmts[0] as ForStatement;
    expect(forStmt.init!.type).toEqual("LetStatement");
    expect(forStmt.condition!.type).toEqual("BinaryExpression");
    expect(forStmt.update!.type).toEqual("PostfixOpExpression");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for loop - single statement body", () => {
    // --- Arrange
    const wParser = new Parser("for (let x = 0; x < 3; x++) y++");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForStatement");
    const forStmt = stmts[0] as ForStatement;
    expect(forStmt.init!.type).toEqual("LetStatement");
    expect(forStmt.condition!.type).toEqual("BinaryExpression");
    expect(forStmt.update!.type).toEqual("PostfixOpExpression");
    expect(forStmt.body.type).toEqual("ExpressionStatement");
  });

  it("for loop - block statement body", () => {
    // --- Arrange
    const wParser = new Parser("for (let x = 0; x < 3; x++) {y++; break;}");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForStatement");
    const forStmt = stmts[0] as ForStatement;
    expect(forStmt.init!.type).toEqual("LetStatement");
    expect(forStmt.condition!.type).toEqual("BinaryExpression");
    expect(forStmt.update!.type).toEqual("PostfixOpExpression");
    expect(forStmt.body.type).toEqual("BlockStatement");
  });

  it("Throw statement - with expression", () => {
    // --- Arrange
    const wParser = new Parser("throw 123;");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ThrowStatement");
    const throwStmt = stmts[0] as ThrowStatement;
    expect(throwStmt.expression!.type).toEqual("Literal");
  });

  it("Try statement - with catch", () => {
    // --- Arrange
    const wParser = new Parser("try { let x = 1; } catch { return; }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("TryStatement");
    const tryStmt = stmts[0] as TryStatement;
    expect(tryStmt.tryBlock.statements[0].type).toEqual("LetStatement");
    expect(tryStmt.catchVariable).toEqual(undefined);
    expect(tryStmt.catchBlock.statements[0].type).toEqual("ReturnStatement");
    expect(tryStmt.finallyBlock).toEqual(undefined);
  });

  it("Try statement - with catch and catch variable", () => {
    // --- Arrange
    const wParser = new Parser("try { let x = 1; } catch (err) { return; }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("TryStatement");
    const tryStmt = stmts[0] as TryStatement;
    expect(tryStmt.tryBlock.statements[0].type).toEqual("LetStatement");
    expect(tryStmt.catchVariable).toEqual("err");
    expect(tryStmt.catchBlock.statements[0].type).toEqual("ReturnStatement");
    expect(tryStmt.finallyBlock).toEqual(undefined);
  });

  it("Try statement - with finally", () => {
    // --- Arrange
    const wParser = new Parser("try { let x = 1; } finally { return; }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("TryStatement");
    const tryStmt = stmts[0] as TryStatement;
    expect(tryStmt.tryBlock.statements[0].type).toEqual("LetStatement");
    expect(tryStmt.catchVariable).toEqual(undefined);
    expect(tryStmt.catchBlock).toEqual(undefined);
    expect(tryStmt.finallyBlock.statements[0].type).toEqual("ReturnStatement");
  });

  it("Try statement - with catch and finally", () => {
    // --- Arrange
    const wParser = new Parser(
      "try { let x = 1; } catch { return; } finally { break; }"
    );

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("TryStatement");
    const tryStmt = stmts[0] as TryStatement;
    expect(tryStmt.tryBlock.statements[0].type).toEqual("LetStatement");
    expect(tryStmt.catchVariable).toEqual(undefined);
    expect(tryStmt.catchBlock.statements[0].type).toEqual("ReturnStatement");
    expect(tryStmt.finallyBlock.statements[0].type).toEqual("BreakStatement");
  });

  it("Try statement - with catch, catch variable, and finally", () => {
    // --- Arrange
    const wParser = new Parser(
      "try { let x = 1; } catch (err) { return; } finally { break; }"
    );

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("TryStatement");
    const tryStmt = stmts[0] as TryStatement;
    expect(tryStmt.tryBlock.statements[0].type).toEqual("LetStatement");
    expect(tryStmt.catchVariable).toEqual("err");
    expect(tryStmt.catchBlock.statements[0].type).toEqual("ReturnStatement");
    expect(tryStmt.finallyBlock.statements[0].type).toEqual("BreakStatement");
  });

  it("Switch statement - empty", () => {
    // --- Arrange
    const wParser = new Parser("switch (myValue) { }");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(0);
  });

  it("Switch statement - single empty label", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(1);
    const swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(0);
  });

  it("Switch statement - single label/single statement", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
        let x = 3;
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(1);
    const swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(1);
  });

  it("Switch statement - single label/multiple statements", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
        let x = 3;
        console.log(x);
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(1);
    const swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(2);
  });

  it("Switch statement - multiple label #1", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
      case 1:
        let x = 3;
        console.log(x);
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(2);
    let swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(0);
    swcCase = swcStmt.cases[1];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(2);
  });

  it("Switch statement - multiple label #2", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
        let x = 3;
        console.log(x);
      case 1:
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(2);
    let swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(2);
    swcCase = swcStmt.cases[1];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(0);
  });

  it("Switch statement - multiple label #3", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
        let x = 3;
        console.log(x);
      case 1:
        break;
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(2);
    let swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(2);
    swcCase = swcStmt.cases[1];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(1);
  });

  it("Switch statement - multiple label #4", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      default:
      case 0:
        let x = 3;
        console.log(x);
      case 1:
        break;
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(3);
    let swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression).toEqual(undefined);
    expect(swcCase.statements.length).toEqual(0);
    swcCase = swcStmt.cases[1];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(2);
    swcCase = swcStmt.cases[2];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(1);
  });

  it("Switch statement - multiple label #5", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
        let x = 3;
        console.log(x);
      default:
      case 1:
        break;
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(3);
    let swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(2);
    swcCase = swcStmt.cases[1];
    expect(swcCase.caseExpression).toEqual(undefined);
    expect(swcCase.statements.length).toEqual(0);
    swcCase = swcStmt.cases[2];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(1);
  });

  it("Switch statement - multiple label #6", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
        let x = 3;
        console.log(x);
      case 1:
      default:
        break;
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(3);
    let swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(2);
    swcCase = swcStmt.cases[1];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(0);
    swcCase = swcStmt.cases[2];
    expect(swcCase.caseExpression).toEqual(undefined);
    expect(swcCase.statements.length).toEqual(1);
  });

  it("Switch statement - multiple label #7", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
        let x = 3;
        console.log(x);
      case 1:
        break;
      default:
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(3);
    let swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(2);
    swcCase = swcStmt.cases[1];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(1);
    swcCase = swcStmt.cases[2];
    expect(swcCase.caseExpression).toEqual(undefined);
    expect(swcCase.statements.length).toEqual(0);
  });

  it("Switch statement - multiple label #8", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      case 0:
        let x = 3;
        console.log(x);
      case 1:
        break;
      default: {
        let x = 0;
        console.log(x);
      }
     }`);

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("SwitchStatement");
    const swcStmt = stmts[0] as SwitchStatement;
    expect(swcStmt.cases.length).toEqual(3);
    let swcCase = swcStmt.cases[0];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(2);
    swcCase = swcStmt.cases[1];
    expect(swcCase.caseExpression.type).toEqual("Literal");
    expect(swcCase.statements.length).toEqual(1);
    swcCase = swcStmt.cases[2];
    expect(swcCase.caseExpression).toEqual(undefined);
    expect(swcCase.statements.length).toEqual(1);
  });

  it("Switch statement - multiple default", () => {
    // --- Arrange
    const wParser = new Parser(`
    switch (myValue) {
      default:
        let x = 3;
        console.log(x);
      case 1:
        break;
      default: {
        let x = 0;
        console.log(x);
      }
     }`);

    // --- Act/Assert
    try {
      wParser.parseStatements()!;
    } catch (err) {
      expect(wParser.errors.length).toEqual(1);
      expect(wParser.errors[0].code).toEqual("K016");
      return;
    }
    assert.fail("Exception expected");
  });

  it("for..in loop - no var binding, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (myVar in collection);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForInStatement");
    const forStmt = stmts[0] as ForInStatement;
    expect(forStmt.varBinding).toEqual("none");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for..in loop - 'let' binding, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (let myVar in collection);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForInStatement");
    const forStmt = stmts[0] as ForInStatement;
    expect(forStmt.varBinding).toEqual("let");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for..in loop - 'const' binding, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (const myVar in collection);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForInStatement");
    const forStmt = stmts[0] as ForInStatement;
    expect(forStmt.varBinding).toEqual("const");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for..in loop - no var binding, body", () => {
    // --- Arrange
    const wParser = new Parser(
      "for (myVar in collection) { console.log(myVar); }"
    );

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForInStatement");
    const forStmt = stmts[0] as ForInStatement;
    expect(forStmt.varBinding).toEqual("none");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("BlockStatement");
  });

  it("for..in loop - 'let' binding, body", () => {
    // --- Arrange
    const wParser = new Parser(
      "for (let myVar in collection) { console.log(myVar); }"
    );

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForInStatement");
    const forStmt = stmts[0] as ForInStatement;
    expect(forStmt.varBinding).toEqual("let");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("BlockStatement");
  });

  it("for..in loop - 'const' binding, body", () => {
    // --- Arrange
    const wParser = new Parser(
      "for (const myVar in collection) { console.log(myVar); }"
    );

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForInStatement");
    const forStmt = stmts[0] as ForInStatement;
    expect(forStmt.varBinding).toEqual("const");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("BlockStatement");
  });

  it("for..of loop - no var binding, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (myVar of collection);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForOfStatement");
    const forStmt = stmts[0] as ForOfStatement;
    expect(forStmt.varBinding).toEqual("none");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for..of loop - 'let' binding, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (let myVar of collection);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForOfStatement");
    const forStmt = stmts[0] as ForOfStatement;
    expect(forStmt.varBinding).toEqual("let");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for..of loop - 'const' binding, no body", () => {
    // --- Arrange
    const wParser = new Parser("for (const myVar of collection);");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForOfStatement");
    const forStmt = stmts[0] as ForOfStatement;
    expect(forStmt.varBinding).toEqual("const");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("EmptyStatement");
  });

  it("for..of loop - no var binding, body", () => {
    // --- Arrange
    const wParser = new Parser(
      "for (myVar of collection) { console.log(myVar); }"
    );

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForOfStatement");
    const forStmt = stmts[0] as ForOfStatement;
    expect(forStmt.varBinding).toEqual("none");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("BlockStatement");
  });

  it("for..of loop - 'let' binding, body", () => {
    // --- Arrange
    const wParser = new Parser(
      "for (let myVar of collection) { console.log(myVar); }"
    );

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForOfStatement");
    const forStmt = stmts[0] as ForOfStatement;
    expect(forStmt.varBinding).toEqual("let");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("BlockStatement");
  });

  it("for..of loop - 'const' binding, body", () => {
    // --- Arrange
    const wParser = new Parser(
      "for (const myVar of collection) { console.log(myVar); }"
    );

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ForOfStatement");
    const forStmt = stmts[0] as ForOfStatement;
    expect(forStmt.varBinding).toEqual("const");
    expect(forStmt.id).toEqual("myVar");
    expect(forStmt.expression.type).toEqual("Identifier");
    expect(forStmt.body.type).toEqual("BlockStatement");
  });
});

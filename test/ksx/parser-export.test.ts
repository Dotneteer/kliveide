import { describe, it, expect } from "vitest";
import assert from "assert";
import { Parser } from "@common/ksx/Parser";
import { ConstStatement, FunctionDeclaration } from "@common/ksx/source-tree";

describe("KSX Parser - export statement", () => {
  it("Exported function", () => {
    // --- Arrange
    const source = "export function myFunc() { return 2*v; }";
    const wParser = new Parser(source);

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const stmt = stmts[0] as FunctionDeclaration;
    expect(stmt.type).toEqual("FunctionDeclaration");
    expect(stmt.isExported).toEqual(true);
    expect(stmt.name).toEqual("myFunc");
    expect(stmt.args.length).toEqual(0);
    expect(stmt.statement.type).toEqual("BlockStatement");
  });

  it("Exported const", () => {
    // --- Arrange
    const wParser = new Parser("export const x = 3");

    // --- Act
    const stmts = wParser.parseStatements()!;

    // --- Assert
    expect(stmts.length).toEqual(1);
    expect(stmts[0].type).toEqual("ConstStatement");
    const constStmt = stmts[0] as ConstStatement;
    expect(constStmt.isExported).toEqual(true);
    expect(constStmt.declarations.length).toEqual(1);
    expect(constStmt.declarations[0].id).toEqual("x");
    expect(constStmt.declarations[0].expression).not.toEqual(null);
    expect(constStmt.declarations[0].expression!.type).toEqual("Literal");
  });

  it("Export fails with let", () => {
    // --- Arrange
    const wParser = new Parser("export let x = 3");

    // --- Act/Assert
    try {
      wParser.parseStatements()!;
    } catch (err) {
      expect(wParser.errors.length).toEqual(1);
      expect(wParser.errors[0].code).toEqual("K019");
      return;
    }
    assert.fail("Exception expected");
  });
});

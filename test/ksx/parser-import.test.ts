import "mocha";
import { expect } from "expect";
import assert from "assert";
import { Parser } from "@main/ksx/Parser";
import { ImportDeclaration } from "@main/ksx/source-tree";

describe("KSX Parser - import statement", () => {
  it("Empty import", () => {
    // --- Arrange
    const source = "import {} from 'myModule'";
    const wParser = new Parser(source);

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const stmt = stmts[0] as ImportDeclaration;
    expect(stmt.type).toEqual("ImportDeclaration");
    expect(Object.keys(stmt.imports).length).toEqual(0);
    expect(stmt.moduleFile).toEqual("myModule");
  });

  it("Single import", () => {
    // --- Arrange
    const source = "import {a} from 'myModule'";
    const wParser = new Parser(source);

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const stmt = stmts[0] as ImportDeclaration;
    expect(stmt.type).toEqual("ImportDeclaration");
    expect(Object.keys(stmt.imports).length).toEqual(1);
    expect(stmt.imports.a).toEqual("a");
    expect(stmt.moduleFile).toEqual("myModule");
  });

  it("Multiple imports", () => {
    // --- Arrange
    const source = "import {a, b, c} from 'myModule'";
    const wParser = new Parser(source);

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const stmt = stmts[0] as ImportDeclaration;
    expect(stmt.type).toEqual("ImportDeclaration");
    expect(Object.keys(stmt.imports).length).toEqual(3);
    expect(stmt.imports.a).toEqual("a");
    expect(stmt.imports.b).toEqual("b");
    expect(stmt.imports.c).toEqual("c");
    expect(stmt.moduleFile).toEqual("myModule");
  });

  it("Single import with alias", () => {
    // --- Arrange
    const source = "import {a as b} from 'myModule'";
    const wParser = new Parser(source);

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const stmt = stmts[0] as ImportDeclaration;
    expect(stmt.type).toEqual("ImportDeclaration");
    expect(Object.keys(stmt.imports).length).toEqual(1);
    expect(stmt.imports.b).toEqual("a");
    expect(stmt.moduleFile).toEqual("myModule");
  });

  it("Multiple imports with alias", () => {
    // --- Arrange
    const source = "import {a as b, c as d, e as f} from 'myModule'";
    const wParser = new Parser(source);

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const stmt = stmts[0] as ImportDeclaration;
    expect(stmt.type).toEqual("ImportDeclaration");
    expect(Object.keys(stmt.imports).length).toEqual(3);
    expect(stmt.imports.b).toEqual("a");
    expect(stmt.imports.d).toEqual("c");
    expect(stmt.imports.f).toEqual("e");
    expect(stmt.moduleFile).toEqual("myModule");
  });
});

import "mocha";
import { expect } from "expect";
import assert from "assert";

import { Parser } from "@main/ksx/Parser";
import { ConstStatement, LetStatement } from "@main/ksx/source-tree";

describe("KSX Parser - destructuring", () => {
  it("let, object, empty", () => {
    // --- Arrange
    const wParser = new Parser("let {} = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(0);
  });

  it("let, object, single ID", () => {
    // --- Arrange
    const wParser = new Parser("let {a} = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(1);
    const od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
  });

  it("let, object, multiple IDs #1", () => {
    // --- Arrange
    const wParser = new Parser("let {a, b} = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(2);
    let od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
    od = decl.objectDestruct[1];
    expect(od.id).toEqual("b");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
  });

  it("let, object, multiple IDs #2", () => {
    // --- Arrange
    const wParser = new Parser("let {a, b, } = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(2);
    let od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
    od = decl.objectDestruct[1];
    expect(od.id).toEqual("b");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
  });

  it("let, object, single aliased ID", () => {
    // --- Arrange
    const wParser = new Parser("let {a: aA} = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(1);
    const od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual("aA");
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
  });

  it("let, object, multiple aliased IDs #1", () => {
    // --- Arrange
    const wParser = new Parser("let {a: aA, b: bB} = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(2);
    let od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual("aA");
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
    od = decl.objectDestruct[1];
    expect(od.id).toEqual("b");
    expect(od.alias).toEqual("bB");
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
  });

  it("let, object, multiple aliased IDs #2", () => {
    // --- Arrange
    const wParser = new Parser("let {a: aA, b: bB, } = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(2);
    let od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual("aA");
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
    od = decl.objectDestruct[1];
    expect(od.id).toEqual("b");
    expect(od.alias).toEqual("bB");
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
  });

  it("let, object, single nested object #1", () => {
    // --- Arrange
    const wParser = new Parser("let {a: {b}} = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(1);
    const od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct.length).toEqual(1);
    const nod = od.objectDestruct[0];
    expect(nod.id).toEqual("b");
    expect(nod.alias).toEqual(undefined);
    expect(nod.arrayDestruct).toEqual(undefined);
    expect(nod.objectDestruct).toEqual(undefined);
  });

  it("let, object, single nested object #2", () => {
    // --- Arrange
    const wParser = new Parser("let {a: {b, c: cC}} = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(1);
    const od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct.length).toEqual(2);
    let nod = od.objectDestruct[0];
    expect(nod.id).toEqual("b");
    expect(nod.alias).toEqual(undefined);
    expect(nod.arrayDestruct).toEqual(undefined);
    expect(nod.objectDestruct).toEqual(undefined);
    nod = od.objectDestruct[1];
    expect(nod.id).toEqual("c");
    expect(nod.alias).toEqual("cC");
    expect(nod.arrayDestruct).toEqual(undefined);
    expect(nod.objectDestruct).toEqual(undefined);
  });

  it("let, array, empty #1", () => {
    // --- Arrange
    const wParser = new Parser("let [] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct).not.toEqual(undefined);
    expect(decl.arrayDestruct.length).toEqual(0);
  });

  it("let, array, empty #2", () => {
    // --- Arrange
    const wParser = new Parser("let [,] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct).not.toEqual(undefined);
    expect(decl.arrayDestruct.length).toEqual(1);
    const ad = decl.arrayDestruct[0];
    expect(ad.id).toEqual(undefined);
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
  });

  it("let, array, single ID", () => {
    // --- Arrange
    const wParser = new Parser("let [a] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct).not.toEqual(undefined);
    expect(decl.arrayDestruct.length).toEqual(1);
    const ad = decl.arrayDestruct[0];
    expect(ad.id).toEqual("a");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
  });

  it("let, array, multiple IDs #1", () => {
    // --- Arrange
    const wParser = new Parser("let [a, b] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct).not.toEqual(undefined);
    expect(decl.arrayDestruct.length).toEqual(2);
    let ad = decl.arrayDestruct[0];
    expect(ad.id).toEqual("a");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[1];
    expect(ad.id).toEqual("b");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
  });

  it("let, array, multiple IDs #2", () => {
    // --- Arrange
    const wParser = new Parser("let [a, b,] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct).not.toEqual(undefined);
    expect(decl.arrayDestruct.length).toEqual(2);
    let ad = decl.arrayDestruct[0];
    expect(ad.id).toEqual("a");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[1];
    expect(ad.id).toEqual("b");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
  });

  it("let, array, multiple IDs #3", () => {
    // --- Arrange
    const wParser = new Parser("let [a,,b,] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct).not.toEqual(undefined);
    expect(decl.arrayDestruct.length).toEqual(3);
    let ad = decl.arrayDestruct[0];
    expect(ad.id).toEqual("a");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[1];
    expect(ad.id).toEqual(undefined);
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[2];
    expect(ad.id).toEqual("b");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
  });

  it("let, array, single nested array #1", () => {
    // --- Arrange
    const wParser = new Parser("let [a, [b,c]] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct).not.toEqual(undefined);
    expect(decl.arrayDestruct.length).toEqual(2);
    let ad = decl.arrayDestruct[0];
    expect(ad.id).toEqual("a");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[1];
    expect(ad.id).toEqual(undefined);
    expect(ad.arrayDestruct.length).toEqual(2);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[1].arrayDestruct[0];
    expect(ad.id).toEqual("b");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[1].arrayDestruct[1];
    expect(ad.id).toEqual("c");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
  });

  it("let, array, single nested array #2", () => {
    // --- Arrange
    const wParser = new Parser("let [[a,b], c] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct).not.toEqual(undefined);
    expect(decl.arrayDestruct.length).toEqual(2);
    let ad = decl.arrayDestruct[0].arrayDestruct[0];
    expect(ad.id).toEqual("a");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[0].arrayDestruct[1];
    expect(ad.id).toEqual("b");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[1];
    expect(ad.id).toEqual("c");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
  });

  it("let, array in object #1", () => {
    // --- Arrange
    const wParser = new Parser("let {a, b: [,c]} = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(2);
    let od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
    od = decl.objectDestruct[1];
    expect(od.id).toEqual("b");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct.length).toEqual(2);
    expect(od.objectDestruct).toEqual(undefined);
    let ad = od.arrayDestruct[0];
    expect(ad.id).toEqual(undefined);
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = od.arrayDestruct[1];
    expect(ad.id).toEqual("c");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
  });

  it("let, object in array #1", () => {
    // --- Arrange
    const wParser = new Parser("let [a, {b, c}] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as LetStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct.length).toEqual(2);
    expect(decl.objectDestruct).toEqual(undefined);
    let ad = decl.arrayDestruct[0];
    expect(ad.id).toEqual("a");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[1];
    expect(ad.id).toEqual(undefined);
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct.length).toEqual(2);
    let od = ad.objectDestruct[0];
    expect(od.id).toEqual("b");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
    od = ad.objectDestruct[1];
    expect(od.id).toEqual("c");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
  });

  it("const, array in object #1", () => {
    // --- Arrange
    const wParser = new Parser("const {a, b: [,c]} = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as ConstStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.objectDestruct).not.toEqual(undefined);
    expect(decl.objectDestruct.length).toEqual(2);
    let od = decl.objectDestruct[0];
    expect(od.id).toEqual("a");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
    od = decl.objectDestruct[1];
    expect(od.id).toEqual("b");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct.length).toEqual(2);
    expect(od.objectDestruct).toEqual(undefined);
    let ad = od.arrayDestruct[0];
    expect(ad.id).toEqual(undefined);
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = od.arrayDestruct[1];
    expect(ad.id).toEqual("c");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
  });

  it("const, object in array #1", () => {
    // --- Arrange
    const wParser = new Parser("const [a, {b, c}] = expr");

    // --- Act
    const stmts = wParser.parseStatements();

    // --- Assert
    expect(stmts.length).toEqual(1);
    const lst = stmts[0] as ConstStatement;
    expect(lst.declarations.length).toEqual(1);
    const decl = lst.declarations[0];
    expect(decl.arrayDestruct.length).toEqual(2);
    expect(decl.objectDestruct).toEqual(undefined);
    let ad = decl.arrayDestruct[0];
    expect(ad.id).toEqual("a");
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct).toEqual(undefined);
    ad = decl.arrayDestruct[1];
    expect(ad.id).toEqual(undefined);
    expect(ad.arrayDestruct).toEqual(undefined);
    expect(ad.objectDestruct.length).toEqual(2);
    let od = ad.objectDestruct[0];
    expect(od.id).toEqual("b");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
    od = ad.objectDestruct[1];
    expect(od.id).toEqual("c");
    expect(od.alias).toEqual(undefined);
    expect(od.arrayDestruct).toEqual(undefined);
    expect(od.objectDestruct).toEqual(undefined);
  });

  it("let, object fails with no initialization", () => {
    // --- Arrange
    const wParser = new Parser("let {}");

    // --- Act/Assert
    try {
      wParser.parseStatements();
    } catch (err) {
      expect(err.toString().includes("=")).toEqual(true);
      return;
    }
    assert.fail("Exception expected");
  });

  it("let, array fails with no initialization", () => {
    // --- Arrange
    const wParser = new Parser("let []");

    // --- Act/Assert
    try {
      wParser.parseStatements();
    } catch (err) {
      expect(err.toString().includes("=")).toEqual(true);
      return;
    }
    assert.fail("Exception expected");
  });
});

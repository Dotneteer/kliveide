import { describe, it, expect } from "vitest";
import { Parser } from "@common/ksx/Parser";
import { Lexer } from "@common/ksx/Lexer";
import { InputStream } from "@common/ksx/InputStream";
import { TokenType } from "@common/ksx/TokenType";

describe("KSX Parser - regression", () => {
  it("Lexer 'toString'", () => {
    // --- Arrange
    const source = "toString";
    const wLexer = new Lexer(new InputStream(source));

    // --- Act
    const token = wLexer.get();

    // --- Assert
    expect(token.type).toEqual(TokenType.Identifier);
  });

  it("Object literal + conditional: 'true.toString()'", () => {
    // --- Act
    const wParser = new Parser("{ x: a ? b : c, y: 1}");
    const expr = wParser.parseExpr();

    // --- Assert
    expect(expr.type).toEqual("ObjectLiteral");
  });
});

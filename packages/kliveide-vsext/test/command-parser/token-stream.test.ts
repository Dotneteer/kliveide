import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/command-parser/input-stream";
import { TokenStream, TokenType } from "../../src/command-parser/token-stream";
import { testToken } from "./token-stream-helper";

describe("Command parser - tokens", () => {
  it("get: empty stream results EOF", () => {
    const ts = new TokenStream(new InputStream(""));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Eof);
    expect(token.text).toBe("");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(0);
  });

  it("get: whitespace #1", () => {
    const ts = new TokenStream(new InputStream(" "));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe(" ");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
  });

  it("get: whitespace #2", () => {
    const ts = new TokenStream(new InputStream("\t"));
    const token = ts.get(true); // --- We intend to obtain whitspaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe("\t");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
  });

  it("get: whitespace #3", () => {
    const ts = new TokenStream(new InputStream(" a"));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe(" ");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
  });

  it("get: whitespace #4", () => {
    const ts = new TokenStream(new InputStream("\ta"));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe("\t");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
  });

  it("get: whitespace #5", () => {
    const ts = new TokenStream(new InputStream(" \t a"));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe(" \t ");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(3);
  });

  it("get: whitespace #6", () => {
    const ts = new TokenStream(new InputStream("\t \ta"));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe("\t \t");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(3);
  });

  it("get: hexadecimal literal", () => {
    testToken("$abcd", TokenType.HexadecimalLiteral);
    testToken("$12ac", TokenType.HexadecimalLiteral);
    testToken("$12acd", TokenType.HexadecimalLiteral);
    testToken("$0", TokenType.HexadecimalLiteral);
    testToken("$a", TokenType.HexadecimalLiteral);
    testToken("$0a", TokenType.HexadecimalLiteral);
    testToken("$a0", TokenType.HexadecimalLiteral);
    testToken("$0a1", TokenType.HexadecimalLiteral);
    testToken("$a0b", TokenType.HexadecimalLiteral);
  });

  it("get: decimal literal", () => {
    testToken("1", TokenType.DecimalLiteral);
    testToken("0", TokenType.DecimalLiteral);
    testToken("9", TokenType.DecimalLiteral);
    testToken("8765432", TokenType.DecimalLiteral);
    testToken("765432", TokenType.DecimalLiteral);
    testToken("65432", TokenType.DecimalLiteral);
    testToken("5432", TokenType.DecimalLiteral);
    testToken("432", TokenType.DecimalLiteral);
    testToken("32", TokenType.DecimalLiteral);
  });
});

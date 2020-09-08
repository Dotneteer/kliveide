import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";
import { TokenStream, TokenType } from "../../src/parser/token-stream";
import { testToken} from "./token-stream-helper";

describe("Parser - token: operator-like", () => {
  it("get: colon", () => {
    testToken(":", TokenType.Colon);
  });

  it("get: double colon", () => {
    testToken("::", TokenType.DoubleColon);
  });

  it("get: comma", () => {
    testToken(",", TokenType.Comma);
  });

  it("get: assign", () => {
    testToken("=", TokenType.Assign);
  });

  it("get: equal", () => {
    testToken("==", TokenType.Equal);
  });

  it("get: case-insensitive equal", () => {
    testToken("===", TokenType.CiEqual);
  });

  it("get: left parenthesis #1", () => {
    testToken("(", TokenType.LPar);
  });

  it("get: right parenthesis", () => {
    testToken(")", TokenType.RPar);
  });

  it("get: left square bracket", () => {
    testToken("[", TokenType.LSBrac);
  });

  it("get: right square bracket", () => {
    testToken("]", TokenType.RSBrac);
  });

  it("get: question mark", () => {
    testToken("?", TokenType.QuestionMark);
  });

  it("get: plus mark", () => {
    testToken("+", TokenType.Plus);
  });

  it("get: minus mark", () => {
    testToken("-", TokenType.Minus);
  });

  it("get: goes-to mark", () => {
    testToken("->", TokenType.GoesTo);
  });

  it("get: vertical bar", () => {
    testToken("|", TokenType.VerticalBar);
  });

  it("get: up arrow", () => {
    testToken("^", TokenType.UpArrow);
  });

  it("get: ampersand #1", () => {
    testToken("&", TokenType.Ampersand);
  });

  it("get: exclamation", () => {
    testToken("!", TokenType.Exclamation);
  });

  it("get: not equal", () => {
    testToken("!=", TokenType.NotEqual);
  });

  it("get: case-insensitive not equal", () => {
    testToken("!==", TokenType.CiNotEqual);
  });

  it("get: less than", () => {
    testToken("<", TokenType.LessThan);
  });

  it("get: less than or equal", () => {
    testToken("<=", TokenType.LessThanOrEqual);
  });

  it("get: left shift", () => {
    testToken("<<", TokenType.LeftShift);
  });

  it("get: minimum operator", () => {
    testToken("<?", TokenType.MinOp);
  });

  it("get: greater than", () => {
    testToken(">", TokenType.GreaterThan);
  });

  it("get: greater than or equal", () => {
    testToken(">=", TokenType.GreaterThanOrEqual);
  });

  it("get: right shift", () => {
    testToken(">>", TokenType.RightShift);
  });

  it("get: maximum operation", () => {
    testToken(">?", TokenType.MaxOp);
  });

  it("get: multiplication", () => {
    testToken("*", TokenType.Multiplication);
  });

  it("get: modulo", () => {
    testToken("%", TokenType.Modulo);
  });

  it("get: binary not", () => {
    testToken("~", TokenType.BinaryNot);
  });

  it("get: double left bracket #1", () => {
    testToken("{{", TokenType.LDBrac);
  });

  it("get: double left bracket #2", () => {
    const ts = new TokenStream(new InputStream("{*"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Unknown);
    expect(token.text).toBe("{");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: double right bracket #1", () => {
    testToken("}}", TokenType.RDBrac);
  });

  it("get: double right bracket #2", () => {
    const ts = new TokenStream(new InputStream("}*"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Unknown);
    expect(token.text).toBe("}");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: dot", () => {
    testToken(".", TokenType.Dot);
  });

});
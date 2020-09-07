import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";
import { TokenStream, TokenType } from "../../src/parser/token-stream";

describe("Parser - token: operator-like", () => {
  it("get: colon #1", () => {
    const ts = new TokenStream(new InputStream(":"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Colon);
    expect(token.text).toBe(":");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: colon #2", () => {
    const ts = new TokenStream(new InputStream(":/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Colon);
    expect(token.text).toBe(":");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: colon #3", () => {
    const ts = new TokenStream(new InputStream("  :"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Colon);
    expect(token.text).toBe(":");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: double colon #1", () => {
    const ts = new TokenStream(new InputStream("::"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.DoubleColon);
    expect(token.text).toBe("::");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: double colon #2", () => {
    const ts = new TokenStream(new InputStream("::/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.DoubleColon);
    expect(token.text).toBe("::");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: double colon #3", () => {
    const ts = new TokenStream(new InputStream("  ::"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.DoubleColon);
    expect(token.text).toBe("::");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: comma #1", () => {
    const ts = new TokenStream(new InputStream(","));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Comma);
    expect(token.text).toBe(",");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: comma #2", () => {
    const ts = new TokenStream(new InputStream(",/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Comma);
    expect(token.text).toBe(",");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: comma #3", () => {
    const ts = new TokenStream(new InputStream("  ,"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Comma);
    expect(token.text).toBe(",");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: assign #1", () => {
    const ts = new TokenStream(new InputStream("="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Assign);
    expect(token.text).toBe("=");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: assign #2", () => {
    const ts = new TokenStream(new InputStream("=/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Assign);
    expect(token.text).toBe("=");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: assign #3", () => {
    const ts = new TokenStream(new InputStream("  ="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Assign);
    expect(token.text).toBe("=");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: equal #1", () => {
    const ts = new TokenStream(new InputStream("=="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Equal);
    expect(token.text).toBe("==");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: equal #2", () => {
    const ts = new TokenStream(new InputStream("==/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Equal);
    expect(token.text).toBe("==");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: equal #3", () => {
    const ts = new TokenStream(new InputStream("  =="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Equal);
    expect(token.text).toBe("==");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: case-insensitive equal #1", () => {
    const ts = new TokenStream(new InputStream("==="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.CiEqual);
    expect(token.text).toBe("===");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: case-insensitive equal #2", () => {
    const ts = new TokenStream(new InputStream("===/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.CiEqual);
    expect(token.text).toBe("===");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: case-insensitive equal #3", () => {
    const ts = new TokenStream(new InputStream("  ==="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.CiEqual);
    expect(token.text).toBe("===");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(5);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(5);
  });

  it("get: left parenthesis #1", () => {
    const ts = new TokenStream(new InputStream("("));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LPar);
    expect(token.text).toBe("(");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: left parenthesis #2", () => {
    const ts = new TokenStream(new InputStream("(/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LPar);
    expect(token.text).toBe("(");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: left parenthesis #3", () => {
    const ts = new TokenStream(new InputStream("  ("));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LPar);
    expect(token.text).toBe("(");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: right parenthesis #1", () => {
    const ts = new TokenStream(new InputStream(")"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RPar);
    expect(token.text).toBe(")");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: right parenthesis #2", () => {
    const ts = new TokenStream(new InputStream(")/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RPar);
    expect(token.text).toBe(")");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: right parenthesis #3", () => {
    const ts = new TokenStream(new InputStream("  )"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RPar);
    expect(token.text).toBe(")");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: left square bracket #1", () => {
    const ts = new TokenStream(new InputStream("["));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LSBrac);
    expect(token.text).toBe("[");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: left square bracket #2", () => {
    const ts = new TokenStream(new InputStream("[/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LSBrac);
    expect(token.text).toBe("[");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: left square bracket #3", () => {
    const ts = new TokenStream(new InputStream("  ["));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LSBrac);
    expect(token.text).toBe("[");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: right square bracket #1", () => {
    const ts = new TokenStream(new InputStream("]"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RSBrac);
    expect(token.text).toBe("]");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: right square bracket #2", () => {
    const ts = new TokenStream(new InputStream("]/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RSBrac);
    expect(token.text).toBe("]");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: right square bracket #3", () => {
    const ts = new TokenStream(new InputStream("  ]"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RSBrac);
    expect(token.text).toBe("]");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: question mark #1", () => {
    const ts = new TokenStream(new InputStream("?"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.QuestionMark);
    expect(token.text).toBe("?");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: question mark #2", () => {
    const ts = new TokenStream(new InputStream("?/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.QuestionMark);
    expect(token.text).toBe("?");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: question mark #3", () => {
    const ts = new TokenStream(new InputStream("  ?"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.QuestionMark);
    expect(token.text).toBe("?");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: plus mark #1", () => {
    const ts = new TokenStream(new InputStream("+"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Plus);
    expect(token.text).toBe("+");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: plus mark #2", () => {
    const ts = new TokenStream(new InputStream("+/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Plus);
    expect(token.text).toBe("+");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: plus mark #3", () => {
    const ts = new TokenStream(new InputStream("  +"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Plus);
    expect(token.text).toBe("+");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: minus mark #1", () => {
    const ts = new TokenStream(new InputStream("-"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Minus);
    expect(token.text).toBe("-");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: minus mark #2", () => {
    const ts = new TokenStream(new InputStream("-/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Minus);
    expect(token.text).toBe("-");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: minus mark #3", () => {
    const ts = new TokenStream(new InputStream("  -"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Minus);
    expect(token.text).toBe("-");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: goes-to mark #1", () => {
    const ts = new TokenStream(new InputStream("->"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.GoesTo);
    expect(token.text).toBe("->");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: goes-to mark #2", () => {
    const ts = new TokenStream(new InputStream("->/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.GoesTo);
    expect(token.text).toBe("->");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: goes-to mark #3", () => {
    const ts = new TokenStream(new InputStream("  ->"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.GoesTo);
    expect(token.text).toBe("->");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: vertical bar #1", () => {
    const ts = new TokenStream(new InputStream("|"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.VerticalBar);
    expect(token.text).toBe("|");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: vertical bar #2", () => {
    const ts = new TokenStream(new InputStream("|/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.VerticalBar);
    expect(token.text).toBe("|");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: vertical bar #3", () => {
    const ts = new TokenStream(new InputStream("  |"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.VerticalBar);
    expect(token.text).toBe("|");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: up arrow #1", () => {
    const ts = new TokenStream(new InputStream("^"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.UpArrow);
    expect(token.text).toBe("^");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: up arrow #2", () => {
    const ts = new TokenStream(new InputStream("^/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.UpArrow);
    expect(token.text).toBe("^");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: up arrow #3", () => {
    const ts = new TokenStream(new InputStream("  ^"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.UpArrow);
    expect(token.text).toBe("^");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: ampersand #1", () => {
    const ts = new TokenStream(new InputStream("&"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Ampersand);
    expect(token.text).toBe("&");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: ampersand #2", () => {
    const ts = new TokenStream(new InputStream("&/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Ampersand);
    expect(token.text).toBe("&");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: ampersand #3", () => {
    const ts = new TokenStream(new InputStream("  &"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Ampersand);
    expect(token.text).toBe("&");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: exclamation #1", () => {
    const ts = new TokenStream(new InputStream("!"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Exclamation);
    expect(token.text).toBe("!");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: exclamation #2", () => {
    const ts = new TokenStream(new InputStream("!/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Exclamation);
    expect(token.text).toBe("!");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: exclamation #3", () => {
    const ts = new TokenStream(new InputStream("  !"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Exclamation);
    expect(token.text).toBe("!");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: not equal #1", () => {
    const ts = new TokenStream(new InputStream("!="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.NotEqual);
    expect(token.text).toBe("!=");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: not equal #2", () => {
    const ts = new TokenStream(new InputStream("!=/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.NotEqual);
    expect(token.text).toBe("!=");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: not equal #3", () => {
    const ts = new TokenStream(new InputStream("  !="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.NotEqual);
    expect(token.text).toBe("!=");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: case-insensitive not equal #1", () => {
    const ts = new TokenStream(new InputStream("!=="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.CiNotEqual);
    expect(token.text).toBe("!==");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: case-insensitive not equal #2", () => {
    const ts = new TokenStream(new InputStream("!==/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.CiNotEqual);
    expect(token.text).toBe("!==");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: case-insensitive not equal #3", () => {
    const ts = new TokenStream(new InputStream("  !=="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.CiNotEqual);
    expect(token.text).toBe("!==");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(5);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(5);
  });

  it("get: less than #1", () => {
    const ts = new TokenStream(new InputStream("<"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LessThan);
    expect(token.text).toBe("<");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: less than #2", () => {
    const ts = new TokenStream(new InputStream("</"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LessThan);
    expect(token.text).toBe("<");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: less than #3", () => {
    const ts = new TokenStream(new InputStream("  <"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LessThan);
    expect(token.text).toBe("<");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: less than or equal #1", () => {
    const ts = new TokenStream(new InputStream("<="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LessThanOrEqual);
    expect(token.text).toBe("<=");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: less than or equal #2", () => {
    const ts = new TokenStream(new InputStream("<=/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LessThanOrEqual);
    expect(token.text).toBe("<=");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: less than or equal #3", () => {
    const ts = new TokenStream(new InputStream("  <="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LessThanOrEqual);
    expect(token.text).toBe("<=");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: left shift #1", () => {
    const ts = new TokenStream(new InputStream("<<"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LeftShift);
    expect(token.text).toBe("<<");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: left shift #2", () => {
    const ts = new TokenStream(new InputStream("<</"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LeftShift);
    expect(token.text).toBe("<<");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: left shift #3", () => {
    const ts = new TokenStream(new InputStream("  <<"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LeftShift);
    expect(token.text).toBe("<<");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: minimum operator #1", () => {
    const ts = new TokenStream(new InputStream("<?"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.MinOp);
    expect(token.text).toBe("<?");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: minimum operator #2", () => {
    const ts = new TokenStream(new InputStream("<?/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.MinOp);
    expect(token.text).toBe("<?");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: minimum operator #3", () => {
    const ts = new TokenStream(new InputStream("  <?"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.MinOp);
    expect(token.text).toBe("<?");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: greater than #1", () => {
    const ts = new TokenStream(new InputStream(">"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.GreaterThan);
    expect(token.text).toBe(">");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: greater than #2", () => {
    const ts = new TokenStream(new InputStream(">/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.GreaterThan);
    expect(token.text).toBe(">");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: greater than #3", () => {
    const ts = new TokenStream(new InputStream("  >"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.GreaterThan);
    expect(token.text).toBe(">");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: greater than or equal #1", () => {
    const ts = new TokenStream(new InputStream(">="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.GreaterThanOrEqual);
    expect(token.text).toBe(">=");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: greater than or equal #2", () => {
    const ts = new TokenStream(new InputStream(">=/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.GreaterThanOrEqual);
    expect(token.text).toBe(">=");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: greater than or equal #3", () => {
    const ts = new TokenStream(new InputStream("  >="));
    const token = ts.get();
    expect(token.type).toBe(TokenType.GreaterThanOrEqual);
    expect(token.text).toBe(">=");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: right shift #1", () => {
    const ts = new TokenStream(new InputStream(">>"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RightShift);
    expect(token.text).toBe(">>");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: right shift #2", () => {
    const ts = new TokenStream(new InputStream(">>/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RightShift);
    expect(token.text).toBe(">>");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: right shift #3", () => {
    const ts = new TokenStream(new InputStream("  >>"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RightShift);
    expect(token.text).toBe(">>");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: maximum operation #1", () => {
    const ts = new TokenStream(new InputStream(">?"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.MaxOp);
    expect(token.text).toBe(">?");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: maximum operation #2", () => {
    const ts = new TokenStream(new InputStream(">?/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.MaxOp);
    expect(token.text).toBe(">?");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });


  it("get: maximum operation #3", () => {
    const ts = new TokenStream(new InputStream("  >?"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.MaxOp);
    expect(token.text).toBe(">?");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: multiplication #1", () => {
    const ts = new TokenStream(new InputStream("*"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Multiplication);
    expect(token.text).toBe("*");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: multiplication #2", () => {
    const ts = new TokenStream(new InputStream("*/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Multiplication);
    expect(token.text).toBe("*");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: multiplication #3", () => {
    const ts = new TokenStream(new InputStream("  *"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Multiplication);
    expect(token.text).toBe("*");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: modulo #1", () => {
    const ts = new TokenStream(new InputStream("%"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Modulo);
    expect(token.text).toBe("%");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: modulo #2", () => {
    const ts = new TokenStream(new InputStream("%/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Modulo);
    expect(token.text).toBe("%");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: modulo #3", () => {
    const ts = new TokenStream(new InputStream("  %"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Modulo);
    expect(token.text).toBe("%");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: binary not #1", () => {
    const ts = new TokenStream(new InputStream("~"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.BinaryNot);
    expect(token.text).toBe("~");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: binary not #2", () => {
    const ts = new TokenStream(new InputStream("~/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.BinaryNot);
    expect(token.text).toBe("~");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: binary not #3", () => {
    const ts = new TokenStream(new InputStream("  ~"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.BinaryNot);
    expect(token.text).toBe("~");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: double left bracket #1", () => {
    const ts = new TokenStream(new InputStream("{{"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LDBrac);
    expect(token.text).toBe("{{");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: double left bracket #2", () => {
    const ts = new TokenStream(new InputStream("{{/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LDBrac);
    expect(token.text).toBe("{{");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: double left bracket #3", () => {
    const ts = new TokenStream(new InputStream("  {{"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.LDBrac);
    expect(token.text).toBe("{{");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: double left bracket #4", () => {
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
    const ts = new TokenStream(new InputStream("}}"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RDBrac);
    expect(token.text).toBe("}}");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: double right bracket #2", () => {
    const ts = new TokenStream(new InputStream("}}/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RDBrac);
    expect(token.text).toBe("}}");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: double right bracket #3", () => {
    const ts = new TokenStream(new InputStream("  }}"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.RDBrac);
    expect(token.text).toBe("}}");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(4);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(4);
  });

  it("get: double right bracket #4", () => {
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

  it("get: dot #1", () => {
    const ts = new TokenStream(new InputStream("."));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Dot);
    expect(token.text).toBe(".");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: dot #2", () => {
    const ts = new TokenStream(new InputStream("./"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Dot);
    expect(token.text).toBe(".");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: dot #3", () => {
    const ts = new TokenStream(new InputStream("  ."));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Dot);
    expect(token.text).toBe(".");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });
});
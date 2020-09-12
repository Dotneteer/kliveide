import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";
import { TokenStream, TokenType } from "../../src/parser/token-stream";

describe("Parser - token: whitespaces/comments", () => {
  it("get: empty stream results EOF", () => {
    const ts = new TokenStream(new InputStream(""));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Eof);
    expect(token.text).toBe("");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(0);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(0);
  });

  it("get: whitespace #1", () => {
    const ts = new TokenStream(new InputStream(" "));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe(" ");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: whitespace #2", () => {
    const ts = new TokenStream(new InputStream("\t"));
    const token = ts.get(true); // --- We intend to obtain whitspaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe("\t");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: whitespace #3", () => {
    const ts = new TokenStream(new InputStream(" a"));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe(" ");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: whitespace #4", () => {
    const ts = new TokenStream(new InputStream("\ta"));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe("\t");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: whitespace #5", () => {
    const ts = new TokenStream(new InputStream(" \t a"));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe(" \t ");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: whitespace #6", () => {
    const ts = new TokenStream(new InputStream("\t \ta"));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.Ws);
    expect(token.text).toBe("\t \t");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: semicolon comment #1", () => {
    const ts = new TokenStream(new InputStream("; This is a comment"));
    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.EolComment);
    expect(token.text).toBe("; This is a comment");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(19);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(19);
  });

  it("get: semicolon comment #2", () => {
    const ts = new TokenStream(new InputStream("  ; This is a comment"));
    expect(ts.get(true).type).toBe(TokenType.Ws);

    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.EolComment);
    expect(token.text).toBe("; This is a comment");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(21);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(21);
  });

  it("get: semicolon comment #3", () => {
    const ts = new TokenStream(new InputStream("\t ; This is a comment\n"));
    expect(ts.get(true).type).toBe(TokenType.Ws);

    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.EolComment);
    expect(token.text).toBe("; This is a comment");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(21);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(21);
  });

  it("get: semicolon comment #4", () => {
    const ts = new TokenStream(new InputStream("\t ; This is a comment\r\n"));
    expect(ts.get(true).type).toBe(TokenType.Ws);

    const token = ts.get(true); // --- We intend to obtain whitespaces
    expect(token.type).toBe(TokenType.EolComment);
    expect(token.text).toBe("; This is a comment");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(21);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(21);
  });

  it("get: divide operator #1", () => {
    const ts = new TokenStream(new InputStream("/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Divide);
    expect(token.text).toBe("/");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: divide operator #2", () => {
    const ts = new TokenStream(new InputStream("  /"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Divide);
    expect(token.text).toBe("/");
    expect(token.location.startPos).toBe(2);
    expect(token.location.endPos).toBe(3);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(2);
    expect(token.location.endColumn).toBe(3);
  });

  it("get: divide operator #3", () => {
    const ts = new TokenStream(new InputStream("/a"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.Divide);
    expect(token.text).toBe("/");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: EOL comment #1", () => {
    const ts = new TokenStream(new InputStream("//"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.EolComment);
    expect(token.text).toBe("//");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: EOL comment #3", () => {
    const ts = new TokenStream(new InputStream("// comment"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.EolComment);
    expect(token.text).toBe("// comment");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(10);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(10);
  });

  it("get: EOL comment #4", () => {
    const ts = new TokenStream(new InputStream("// comment\r"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.EolComment);
    expect(token.text).toBe("// comment");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(10);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(10);
  });

  it("get: EOL comment #5", () => {
    const ts = new TokenStream(new InputStream("// comment\r\n"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.EolComment);
    expect(token.text).toBe("// comment");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(10);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(10);
  });

  it("get: Inline comment #1", () => {
    const ts = new TokenStream(new InputStream("/* comment */"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.InlineComment);
    expect(token.text).toBe("/* comment */");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(13);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(13);
  });

  it("get: Inline comment #2", () => {
    const ts = new TokenStream(new InputStream("/* com*ent */"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.InlineComment);
    expect(token.text).toBe("/* com*ent */");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(13);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(13);
  });

  it("get: Inline comment #3", () => {
    const ts = new TokenStream(new InputStream("/*"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.Unknown);
    expect(token.text).toBe("/*");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });

  it("get: Inline comment #4", () => {
    const ts = new TokenStream(new InputStream("/* com\nent */"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.Unknown);
    expect(token.text).toBe("/* com");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(6);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(6);
  });

  it("get: Inline comment #5", () => {
    const ts = new TokenStream(new InputStream("/* com\rent */"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.Unknown);
    expect(token.text).toBe("/* com");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(6);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(6);
  });

  it("get: Inline comment #6", () => {
    const ts = new TokenStream(new InputStream("/* comment *"));
    const token = ts.get(true); // --- We intend to obtain comments
    expect(token.type).toBe(TokenType.Unknown);
    expect(token.text).toBe("/* comment *");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(12);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(12);
  });

  it("get: Inline comment #7", () => {
    const ts = new TokenStream(new InputStream("/* comment *//"));
    const token = ts.get(); // --- We skip comments
    expect(token.type).toBe(TokenType.Divide);
    expect(token.text).toBe("/");
    expect(token.location.startPos).toBe(13);
    expect(token.location.endPos).toBe(14);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(13);
    expect(token.location.endColumn).toBe(14);
  });

  it("get: new line #1", () => {
    const ts = new TokenStream(new InputStream("\r"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.NewLine);
    expect(token.text).toBe("\r");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: new line #2", () => {
    const ts = new TokenStream(new InputStream("\r/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.NewLine);
    expect(token.text).toBe("\r");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: new line #3", () => {
    const ts = new TokenStream(new InputStream("\n"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.NewLine);
    expect(token.text).toBe("\n");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: new line #4", () => {
    const ts = new TokenStream(new InputStream("\n/"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.NewLine);
    expect(token.text).toBe("\n");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(1);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(1);
  });

  it("get: new line #5", () => {
    const ts = new TokenStream(new InputStream("\r\n"));
    const token = ts.get();
    expect(token.type).toBe(TokenType.NewLine);
    expect(token.text).toBe("\r\n");
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(2);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(2);
  });
});


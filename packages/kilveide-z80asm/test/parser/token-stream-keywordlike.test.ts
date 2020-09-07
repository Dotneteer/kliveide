import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";
import { TokenStream, TokenType } from "../../src/parser/token-stream";

describe("Parser - token: operator-like", () => {
  it("get: org pragma", () => {
    testToken(".org", TokenType.Org);
    testToken(".ORG", TokenType.Org);
    testToken("org", TokenType.Org);
    testToken("ORG", TokenType.Org);
  });

  it("get: xorg pragma", () => {
    testToken(".xorg", TokenType.Xorg);
    testToken(".XORG", TokenType.Xorg);
    testToken("xorg", TokenType.Xorg);
    testToken("XORG", TokenType.Xorg);
  });

  it("get: ent pragma", () => {
    testToken(".ent", TokenType.Ent);
    testToken(".ENT", TokenType.Ent);
    testToken("ent", TokenType.Ent);
    testToken("ENT", TokenType.Ent);
  });

  it("get: xent pragma", () => {
    testToken(".xent", TokenType.Xent);
    testToken(".XENT", TokenType.Xent);
    testToken("xent", TokenType.Xent);
    testToken("XENT", TokenType.Xent);
  });

  it("get: equ pragma", () => {
    testToken(".equ", TokenType.Equ);
    testToken(".EQU", TokenType.Equ);
    testToken("equ", TokenType.Equ);
    testToken("EQU", TokenType.Equ);
  });

  it("get: var pragma", () => {
    testToken(".var", TokenType.Var);
    testToken(".VAR", TokenType.Var);
    testToken("var", TokenType.Var);
    testToken("VAR", TokenType.Var);
    testToken(":=", TokenType.Var);
  });

  it("get: disp pragma", () => {
    testToken(".disp", TokenType.Disp);
    testToken(".DISP", TokenType.Disp);
    testToken("disp", TokenType.Disp);
    testToken("DISP", TokenType.Disp);
  });

  it("get: defb pragma", () => {
    testToken(".defb", TokenType.Defb);
    testToken(".DEFB", TokenType.Defb);
    testToken("defb", TokenType.Defb);
    testToken("DB", TokenType.Defb);
    testToken(".db", TokenType.Defb);
    testToken(".DB", TokenType.Defb);
    testToken("db", TokenType.Defb);
    testToken("DB", TokenType.Defb);
  });

  it("get: defw pragma", () => {
    testToken(".defw", TokenType.Defw);
    testToken(".DEFW", TokenType.Defw);
    testToken("defw", TokenType.Defw);
    testToken("DEFW", TokenType.Defw);
    testToken(".dw", TokenType.Defw);
    testToken(".DW", TokenType.Defw);
    testToken("dw", TokenType.Defw);
    testToken("DW", TokenType.Defw);
  });

  it("get: defm pragma", () => {
    testToken(".defm", TokenType.Defm);
    testToken(".DEFM", TokenType.Defm);
    testToken("defm", TokenType.Defm);
    testToken("DEFM", TokenType.Defm);
    testToken(".dm", TokenType.Defm);
    testToken(".DM", TokenType.Defm);
    testToken("dm", TokenType.Defm);
    testToken("DM", TokenType.Defm);
  });

  it("get: defn pragma", () => {
    testToken(".defn", TokenType.Defn);
    testToken(".DEFN", TokenType.Defn);
    testToken("defn", TokenType.Defn);
    testToken("DEFN", TokenType.Defn);
    testToken(".dn", TokenType.Defn);
    testToken(".DN", TokenType.Defn);
    testToken("dn", TokenType.Defn);
    testToken("DN", TokenType.Defn);
  });

  it("get: defh pragma", () => {
    testToken(".defh", TokenType.Defh);
    testToken(".DEFH", TokenType.Defh);
    testToken("defh", TokenType.Defh);
    testToken("DEFH", TokenType.Defh);
    testToken(".dh", TokenType.Defh);
    testToken(".DH", TokenType.Defh);
    testToken("dh", TokenType.Defh);
    testToken("DH", TokenType.Defh);
  });

  it("get: defgx pragma", () => {
    testToken(".defgx", TokenType.Defgx);
    testToken(".DEFGX", TokenType.Defgx);
    testToken("defgx", TokenType.Defgx);
    testToken("DEFGX", TokenType.Defgx);
    testToken(".dgx", TokenType.Defgx);
    testToken(".DGX", TokenType.Defgx);
    testToken("dgx", TokenType.Defgx);
    testToken("DGX", TokenType.Defgx);
  });

  it("get: defg pragma", () => {
    testToken(".defg", TokenType.Defg);
    testToken(".DEFG", TokenType.Defg);
    testToken("defg", TokenType.Defg);
    testToken("DEFG", TokenType.Defg);
    testToken(".dg", TokenType.Defg);
    testToken(".DG", TokenType.Defg);
    testToken("dg", TokenType.Defg);
    testToken("DG", TokenType.Defg);
  });

  it("get: defc pragma", () => {
    testToken(".defc", TokenType.Defc);
    testToken(".DEFC", TokenType.Defc);
    testToken("defc", TokenType.Defc);
    testToken("DEFC", TokenType.Defc);
    testToken(".dc", TokenType.Defc);
    testToken(".DC", TokenType.Defc);
    testToken("dc", TokenType.Defc);
    testToken("DC", TokenType.Defc);
  });

  it("get: skip pragma", () => {
    testToken(".skip", TokenType.Skip);
    testToken(".SKIP", TokenType.Skip);
    testToken("skip", TokenType.Skip);
    testToken("SKIP", TokenType.Skip);
  });

  it("get: extern pragma", () => {
    testToken(".extern", TokenType.Extern);
    testToken(".EXTERN", TokenType.Extern);
    testToken("extern", TokenType.Extern);
    testToken("EXTERN", TokenType.Extern);
  });

  it("get: defs pragma", () => {
    testToken(".defs", TokenType.Defs);
    testToken(".DEFS", TokenType.Defs);
    testToken("defs", TokenType.Defs);
    testToken("DEFS", TokenType.Defs);
    testToken(".ds", TokenType.Defs);
    testToken(".DS", TokenType.Defs);
    testToken("ds", TokenType.Defs);
    testToken("DS", TokenType.Defs);
  });

  it("get: fillb pragma", () => {
    testToken(".fillb", TokenType.Fillb);
    testToken(".FILLB", TokenType.Fillb);
    testToken("fillb", TokenType.Fillb);
    testToken("FILLB", TokenType.Fillb);
  });

  it("get: fillw pragma", () => {
    testToken(".fillw", TokenType.Fillw);
    testToken(".FILLW", TokenType.Fillw);
    testToken("fillw", TokenType.Fillw);
    testToken("FILLW", TokenType.Fillw);
  });

  it("get: model pragma", () => {
    testToken(".model", TokenType.Model);
    testToken(".MODEL", TokenType.Model);
    testToken("model", TokenType.Model);
    testToken("MODEL", TokenType.Model);
  });

  it("get: align pragma", () => {
    testToken(".align", TokenType.Align);
    testToken(".ALIGN", TokenType.Align);
    testToken("align", TokenType.Align);
    testToken("ALIGN", TokenType.Align);
  });

  it("get: identifier", () => {
    testToken("_", TokenType.Identifier);
    testToken("@", TokenType.Identifier);
    testToken("`", TokenType.Identifier);
    testToken("apple", TokenType.Identifier);
    testToken("apple_", TokenType.Identifier);
    testToken("apple@", TokenType.Identifier);
    testToken("apple!", TokenType.Identifier);
    testToken("apple?", TokenType.Identifier);
    testToken("apple#", TokenType.Identifier);
    testToken("apple112", TokenType.Identifier);
  });

});

function testToken(tokenStr: string, type: TokenType): void {
  // --- Test for the single token
  let ts = new TokenStream(new InputStream(tokenStr));
  let token = ts.get();
  expect(token.type).toBe(type);
  expect(token.text).toBe(tokenStr);
  expect(token.location.startPos).toBe(0);
  expect(token.location.endPos).toBe(tokenStr.length);
  expect(token.location.line).toBe(1);
  expect(token.location.startColumn).toBe(0);
  expect(token.location.endColumn).toBe(tokenStr.length);

  // --- Test for token with subsequent token
  ts = new TokenStream(new InputStream(tokenStr + "/"));
  token = ts.get();
  expect(token.type).toBe(type);
  expect(token.text).toBe(tokenStr);
  expect(token.location.startPos).toBe(0);
  expect(token.location.endPos).toBe(tokenStr.length);
  expect(token.location.line).toBe(1);
  expect(token.location.startColumn).toBe(0);
  expect(token.location.endColumn).toBe(tokenStr.length);

  // --- Test for token with leading whitespace
  ts = new TokenStream(new InputStream("  " + tokenStr));
  token = ts.get();
  expect(token.type).toBe(type);
  expect(token.text).toBe(tokenStr);
  expect(token.location.startPos).toBe(2);
  expect(token.location.endPos).toBe(tokenStr.length + 2);
  expect(token.location.line).toBe(1);
  expect(token.location.startColumn).toBe(2);
  expect(token.location.endColumn).toBe(tokenStr.length + 2);
}

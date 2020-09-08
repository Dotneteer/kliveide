import * as expect from "expect";
import { TokenType, TokenStream } from "../../src/parser/token-stream";
import { InputStream } from "../../src/parser/input-stream";

export function testToken(tokenStr: string, type: TokenType): void {
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

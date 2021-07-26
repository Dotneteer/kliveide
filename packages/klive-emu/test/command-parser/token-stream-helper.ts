import * as expect from "expect";
import { TokenType, TokenStream } from "../../src/shared/command-parser/token-stream";
import { InputStream } from "../../src/shared/command-parser/input-stream";

export function testToken(
  tokenStr: string,
  type: TokenType,
  errorToken?: string | null
): void {
  // --- Test for the single token
  const resultStr = errorToken ?? tokenStr;
  let ts = new TokenStream(new InputStream(tokenStr));

  let token = ts.get();
  expect(token.type).toBe(type);
  expect(token.text).toBe(resultStr);
  expect(token.location.startPos).toBe(0);
  expect(token.location.endPos).toBe(resultStr.length);
  expect(token.location.line).toBe(1);
  expect(token.location.startColumn).toBe(0);
  expect(token.location.endColumn).toBe(resultStr.length);

  // --- Test for token with subsequent token
  if (errorToken !== null) {
    ts = new TokenStream(new InputStream(tokenStr + " /"));
    token = ts.get();
    expect(token.type).toBe(type);
    expect(token.text).toBe(resultStr);
    expect(token.location.startPos).toBe(0);
    expect(token.location.endPos).toBe(resultStr.length);
    expect(token.location.line).toBe(1);
    expect(token.location.startColumn).toBe(0);
    expect(token.location.endColumn).toBe(resultStr.length);
  }

  // --- Test for token with leading whitespace
  ts = new TokenStream(new InputStream("  " + tokenStr));
  token = ts.get();
  expect(token.type).toBe(type);
  expect(token.text).toBe(resultStr);
  expect(token.location.startPos).toBe(2);
  expect(token.location.endPos).toBe(resultStr.length + 2);
  expect(token.location.line).toBe(1);
  expect(token.location.startColumn).toBe(2);
  expect(token.location.endColumn).toBe(resultStr.length + 2);
}

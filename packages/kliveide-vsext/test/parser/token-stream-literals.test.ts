import "mocha";

import { TokenType } from "../../src/z80lang/parser/token-stream";
import { testToken } from "./token-stream-helper";

describe("Parser - token: literals", () => {
  it("get: hexadecimal literal #1", () => {
    testToken("#abcd", TokenType.HexadecimalLiteral);
    testToken("#12ac", TokenType.HexadecimalLiteral);
    testToken("#12acd", TokenType.Unknown);
    testToken("#0", TokenType.HexadecimalLiteral);
    testToken("#a", TokenType.HexadecimalLiteral);
    testToken("#0a", TokenType.HexadecimalLiteral);
    testToken("#a0", TokenType.HexadecimalLiteral);
    testToken("#0a1", TokenType.HexadecimalLiteral);
    testToken("#a0b", TokenType.HexadecimalLiteral);
  });

  it("get: hexadecimal literal #2", () => {
    testToken("$abcd", TokenType.HexadecimalLiteral);
    testToken("$12ac", TokenType.HexadecimalLiteral);
    testToken("$12acd", TokenType.Unknown);
    testToken("$0", TokenType.HexadecimalLiteral);
    testToken("$a", TokenType.HexadecimalLiteral);
    testToken("$0a", TokenType.HexadecimalLiteral);
    testToken("$a0", TokenType.HexadecimalLiteral);
    testToken("$0a1", TokenType.HexadecimalLiteral);
    testToken("$a0b", TokenType.HexadecimalLiteral);
  });

  it("get: hexadecimal literal #3", () => {
    testToken("0x12acd", TokenType.Unknown);
    testToken("0x0", TokenType.HexadecimalLiteral);
    testToken("0xabcd", TokenType.HexadecimalLiteral);
    testToken("0x12ac", TokenType.HexadecimalLiteral);
    testToken("0xa", TokenType.HexadecimalLiteral);
    testToken("0x0a", TokenType.HexadecimalLiteral);
    testToken("0xa0", TokenType.HexadecimalLiteral);
    testToken("0x0a1", TokenType.HexadecimalLiteral);
    testToken("0xa0b", TokenType.HexadecimalLiteral);
  });

  it("get: hexadecimal literal #4", () => {
    testToken("0h", TokenType.HexadecimalLiteral);
    testToken("01ch", TokenType.HexadecimalLiteral);
    testToken("012ah", TokenType.HexadecimalLiteral);
    testToken("012ach", TokenType.HexadecimalLiteral);
    testToken("0H", TokenType.HexadecimalLiteral);
    testToken("01cH", TokenType.HexadecimalLiteral);
    testToken("012aH", TokenType.HexadecimalLiteral);
    testToken("012acH", TokenType.HexadecimalLiteral);
  });

  it("get: binary literal #1", () => {
    testToken("%0", TokenType.BinaryLiteral);
    testToken("%1", TokenType.BinaryLiteral);
    testToken("%_", TokenType.BinaryLiteral);
    testToken("%0111_0001", TokenType.BinaryLiteral);
    testToken("%1111_0001", TokenType.BinaryLiteral);
    testToken("%_111_0001", TokenType.BinaryLiteral);
  });

  it("get: octal literal #1", () => {
    testToken("0q", TokenType.OctalLiteral);
    testToken("0Q", TokenType.OctalLiteral);
    testToken("0o", TokenType.OctalLiteral);
    testToken("0O", TokenType.OctalLiteral);
  });

  it("get: octal literal #2", () => {
    testToken("7q", TokenType.OctalLiteral);
    testToken("75q", TokenType.OctalLiteral);
    testToken("123456q", TokenType.OctalLiteral);
    testToken("76543q", TokenType.OctalLiteral);
    testToken("7543q", TokenType.OctalLiteral);
    testToken("754q", TokenType.OctalLiteral);
    testToken("7Q", TokenType.OctalLiteral);
    testToken("75Q", TokenType.OctalLiteral);
    testToken("123456Q", TokenType.OctalLiteral);
    testToken("76543Q", TokenType.OctalLiteral);
    testToken("7543Q", TokenType.OctalLiteral);
    testToken("754Q", TokenType.OctalLiteral);
    testToken("7o", TokenType.OctalLiteral);
    testToken("75o", TokenType.OctalLiteral);
    testToken("123456o", TokenType.OctalLiteral);
    testToken("76543o", TokenType.OctalLiteral);
    testToken("7543o", TokenType.OctalLiteral);
    testToken("754o", TokenType.OctalLiteral);
    testToken("7O", TokenType.OctalLiteral);
    testToken("75O", TokenType.OctalLiteral);
    testToken("123456O", TokenType.OctalLiteral);
    testToken("76543O", TokenType.OctalLiteral);
    testToken("7543O", TokenType.OctalLiteral);
    testToken("754O", TokenType.OctalLiteral);
  });

  it("get: decimal literal #1", () => {
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

  it("get: real literal #1", () => {
    testToken("0e0", TokenType.RealLiteral);
    testToken("0e+0", TokenType.RealLiteral);
    testToken("0e-0", TokenType.RealLiteral);
    testToken("0e+12", TokenType.RealLiteral);
    testToken("0e-23", TokenType.RealLiteral);
    testToken("0.0e0", TokenType.RealLiteral);
    testToken("0.1e+0", TokenType.RealLiteral);
    testToken("0.2e-0", TokenType.RealLiteral);
    testToken("0.3e+12", TokenType.RealLiteral);
    testToken("0.4e-23", TokenType.RealLiteral);
    testToken("0.023e0", TokenType.RealLiteral);
    testToken("0.134e+0", TokenType.RealLiteral);
    testToken("0.245e-0", TokenType.RealLiteral);
    testToken("0.356e+12", TokenType.RealLiteral);
    testToken("0.467e-23", TokenType.RealLiteral);
    testToken("1e0", TokenType.RealLiteral);
    testToken("1e+0", TokenType.RealLiteral);
    testToken("1e-0", TokenType.RealLiteral);
    testToken("1e+12", TokenType.RealLiteral);
    testToken("1e-23", TokenType.RealLiteral);
    testToken("1.0e0", TokenType.RealLiteral);
    testToken("1.1e+0", TokenType.RealLiteral);
    testToken("1.2e-0", TokenType.RealLiteral);
    testToken("1.3e+12", TokenType.RealLiteral);
    testToken("1.4e-23", TokenType.RealLiteral);
    testToken("1.023e0", TokenType.RealLiteral);
    testToken("1.134e+0", TokenType.RealLiteral);
    testToken("1.245e-0", TokenType.RealLiteral);
    testToken("1.356e+12", TokenType.RealLiteral);
    testToken("1.467e-23", TokenType.RealLiteral);
    testToken("1e0", TokenType.RealLiteral);
    testToken("1e+0", TokenType.RealLiteral);
    testToken("671e-0", TokenType.RealLiteral);
    testToken("781e+12", TokenType.RealLiteral);
    testToken("121e-23", TokenType.RealLiteral);
    testToken("121.0e0", TokenType.RealLiteral);
    testToken("231.1e+0", TokenType.RealLiteral);
    testToken("341.2e-0", TokenType.RealLiteral);
    testToken("451.3e+12", TokenType.RealLiteral);
    testToken("561.4e-23", TokenType.RealLiteral);
    testToken("671.023e0", TokenType.RealLiteral);
    testToken("781.134e+0", TokenType.RealLiteral);
    testToken("891.245e-0", TokenType.RealLiteral);
    testToken("911.356e+12", TokenType.RealLiteral);
    testToken("121.467e-23", TokenType.RealLiteral);
    testToken(".0e0", TokenType.RealLiteral);
    testToken(".1e+0", TokenType.RealLiteral);
    testToken(".2e-0", TokenType.RealLiteral);
    testToken(".3e+12", TokenType.RealLiteral);
    testToken(".4e-23", TokenType.RealLiteral);
    testToken(".023e0", TokenType.RealLiteral);
    testToken(".134e+0", TokenType.RealLiteral);
    testToken(".245e-0", TokenType.RealLiteral);
    testToken(".356e+12", TokenType.RealLiteral);
    testToken(".467e-23", TokenType.RealLiteral);
  });

  it("get: real literal #2", () => {
    testToken("0e+", TokenType.Unknown);
    testToken("0e-", TokenType.Unknown);
    testToken("911.356e+", TokenType.Unknown);
    testToken("121.467e-", TokenType.Unknown);
    testToken(".e+0", TokenType.Unknown, ".e");
    testToken(".e-0", TokenType.Unknown, ".e");
  });

  it("get: character literal #1", () => {
    testToken("'a'", TokenType.CharLiteral);
    testToken("'q'", TokenType.CharLiteral);
    testToken("'\\i'", TokenType.CharLiteral);
    testToken("'\\p'", TokenType.CharLiteral);
    testToken("'\\f'", TokenType.CharLiteral);
    testToken("'\\b'", TokenType.CharLiteral);
    testToken("'\\I'", TokenType.CharLiteral);
    testToken("'\\o'", TokenType.CharLiteral);
    testToken("'\\a'", TokenType.CharLiteral);
    testToken("'\\t'", TokenType.CharLiteral);
    testToken("'\\P'", TokenType.CharLiteral);
    testToken("'\\C'", TokenType.CharLiteral);
    testToken("'\\''", TokenType.CharLiteral);
    testToken("'\\\"'", TokenType.CharLiteral);
    testToken("'\\0'", TokenType.CharLiteral);
    testToken("'\\\\'", TokenType.CharLiteral);

    testToken("'\\x01'", TokenType.CharLiteral);
    testToken("'\\xa1'", TokenType.CharLiteral);
    testToken("'\\xBC'", TokenType.CharLiteral);
  });

  it("get: character literal #2", () => {
    testToken("'\\'", TokenType.Unknown, null);
    testToken("'\\x0'", TokenType.Unknown, null);
    testToken("'a", TokenType.Unknown, null);
  });

  it("get: string literal #1", () => {
    testToken('""', TokenType.StringLiteral);
    testToken('"a"', TokenType.StringLiteral);
    testToken('"abcd"', TokenType.StringLiteral);
    testToken('"\\i"', TokenType.StringLiteral);
    testToken('"\\p"', TokenType.StringLiteral);
    testToken('"\\f"', TokenType.StringLiteral);
    testToken('"\\b"', TokenType.StringLiteral);
    testToken('"\\I"', TokenType.StringLiteral);
    testToken('"\\o"', TokenType.StringLiteral);
    testToken('"\\a"', TokenType.StringLiteral);
    testToken('"\\t"', TokenType.StringLiteral);
    testToken('"\\P"', TokenType.StringLiteral);
    testToken('"\\C"', TokenType.StringLiteral);
    testToken('"\\\'"', TokenType.StringLiteral);
    testToken('"\\""', TokenType.StringLiteral);
    testToken('"\\0"', TokenType.StringLiteral);
    testToken('"\\\\"', TokenType.StringLiteral);

    testToken('"\\x01"', TokenType.StringLiteral);
    testToken('"\\xa1"', TokenType.StringLiteral);
    testToken('"\\xBC"', TokenType.StringLiteral);
  });

  it("get: string literal #2", () => {
    testToken('"\\"', TokenType.Unknown, null);
    testToken('"\\x0"', TokenType.Unknown, null);
    testToken('"a', TokenType.Unknown, null);
  });
});

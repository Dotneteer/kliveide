import { TokenType } from "../../src/shared/command-parser/token-stream";
import { testToken } from "./token-stream-helper";

describe("Command parser - token: literals", () => {
    it("get: string literal #1", () => {
        testToken('""', TokenType.String);
        testToken('"a"', TokenType.String);
        testToken('"abcd"', TokenType.String);
        testToken('"\\b"', TokenType.String);
        testToken('"\\f"', TokenType.String);
        testToken('"\\n"', TokenType.String);
        testToken('"\\r"', TokenType.String);
        testToken('"\\t"', TokenType.String);
        testToken('"\\v"', TokenType.String);
        testToken('"\\0"', TokenType.String);
        testToken('"\\\'"', TokenType.String);
        testToken('"\\""', TokenType.String);
        testToken('"\\\\"', TokenType.String);
    
        testToken('"\\x01"', TokenType.String);
        testToken('"\\xa1"', TokenType.String);
        testToken('"\\xBC"', TokenType.String);
      });
    
      it("get: string literal #2", () => {
        testToken('"\\"', TokenType.Unknown, null);
        testToken('"\\x0"', TokenType.Unknown, null);
        testToken('"a', TokenType.Unknown, null);
      });
    });
    
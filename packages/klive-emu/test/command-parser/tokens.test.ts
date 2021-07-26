import { TokenType } from "../../src/shared/command-parser/token-stream";
import { testToken } from "./token-stream-helper";

describe("Command parser - tokens", () => {
  it("String literal #1", () => {
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

  it("String literal #2", () => {
    testToken('"\\"', TokenType.Unknown, null);
    testToken('"\\x0"', TokenType.Unknown, null);
    testToken('"a', TokenType.Unknown, null);
  });

  it("Variable #1", () => {
    testToken("${a}", TokenType.Variable);
    testToken("${z}", TokenType.Variable);
    testToken("${A}", TokenType.Variable);
    testToken("${Z}", TokenType.Variable);
    testToken("${_}", TokenType.Variable);
    testToken("${a0}", TokenType.Variable);
    testToken("${a9}", TokenType.Variable);
    testToken("${a-}", TokenType.Variable);
    testToken("${a$}", TokenType.Variable);
    testToken("${a.}", TokenType.Variable);
    testToken("${a!}", TokenType.Variable);
    testToken("${a:}", TokenType.Variable);
    testToken("${a#}", TokenType.Variable);
    testToken("${project-root}", TokenType.Variable);
  });

  it("Variable #2", () => {
    testToken("${0}", TokenType.Unknown, "${0");
    testToken("${$}", TokenType.Unknown, "${$");
    testToken("${a*}", TokenType.Unknown, "${a*");
    testToken("${project-root", TokenType.Unknown, null);
  });

  it("Hexadecimal literal #1", () => {
    testToken("$abcd", TokenType.HexadecimalLiteral);
    testToken("$12ac", TokenType.HexadecimalLiteral);
    testToken("$12acd", TokenType.HexadecimalLiteral);
    testToken("$0", TokenType.HexadecimalLiteral);
    testToken("$a", TokenType.HexadecimalLiteral);
    testToken("$0a", TokenType.HexadecimalLiteral);
    testToken("$a0", TokenType.HexadecimalLiteral);
    testToken("$0a1", TokenType.HexadecimalLiteral);
    testToken("$a0b", TokenType.HexadecimalLiteral);
    testToken("$a_bcd", TokenType.HexadecimalLiteral);
    testToken("$ab_cd", TokenType.HexadecimalLiteral);
    testToken("$ab'cd'", TokenType.HexadecimalLiteral);
  });

  it("Hexadecimal literal #2", () => {
    testToken("-$abcd", TokenType.HexadecimalLiteral);
    testToken("-$12ac", TokenType.HexadecimalLiteral);
    testToken("-$12acd", TokenType.HexadecimalLiteral);
    testToken("-$0", TokenType.HexadecimalLiteral);
    testToken("-$a", TokenType.HexadecimalLiteral);
    testToken("-$0a", TokenType.HexadecimalLiteral);
    testToken("-$a0", TokenType.HexadecimalLiteral);
    testToken("-$0a1", TokenType.HexadecimalLiteral);
    testToken("-$a0b", TokenType.HexadecimalLiteral);
    testToken("-$a_bcd", TokenType.HexadecimalLiteral);
    testToken("-$ab_cd", TokenType.HexadecimalLiteral);
    testToken("-$ab'cd'", TokenType.HexadecimalLiteral);
  });

  it("Hexadecimal literal #3", () => {
    testToken("$abq", TokenType.Argument);
    testToken("-$abq", TokenType.Argument);
  });

  it("Binary literal #1", () => {
    testToken("%0", TokenType.BinaryLiteral);
    testToken("%1", TokenType.BinaryLiteral);
    testToken("%01110001", TokenType.BinaryLiteral);
    testToken("%0111_0001", TokenType.BinaryLiteral);
    testToken("%1111_0001", TokenType.BinaryLiteral);
    testToken("%01_11_0001", TokenType.BinaryLiteral);
    testToken("%11_11_0001_", TokenType.BinaryLiteral);
    testToken("%0111'0001", TokenType.BinaryLiteral);
    testToken("%1111'0001", TokenType.BinaryLiteral);
    testToken("%01'11'0001", TokenType.BinaryLiteral);
    testToken("%11'11_0001'", TokenType.BinaryLiteral);
    testToken("-%0", TokenType.BinaryLiteral);
    testToken("-%1", TokenType.BinaryLiteral);
    testToken("-%01110001", TokenType.BinaryLiteral);
    testToken("-%0111_0001", TokenType.BinaryLiteral);
    testToken("-%1111_0001", TokenType.BinaryLiteral);
    testToken("-%01_11_0001", TokenType.BinaryLiteral);
    testToken("-%11_11_0001_", TokenType.BinaryLiteral);
    testToken("-%0111'0001", TokenType.BinaryLiteral);
    testToken("-%1111'0001", TokenType.BinaryLiteral);
    testToken("-%01'11'0001", TokenType.BinaryLiteral);
    testToken("-%11'11_0001'", TokenType.BinaryLiteral);
  });

  it("Binary literal #2", () => {
    testToken("%_", TokenType.Argument);
    testToken("%_111_0001", TokenType.Argument);
    testToken("%1112", TokenType.Argument);
    testToken("%11q111", TokenType.Argument);
  });

  it("Decimal literal #1", () => {
    testToken("1", TokenType.DecimalLiteral);
    testToken("0", TokenType.DecimalLiteral);
    testToken("9", TokenType.DecimalLiteral);
    testToken("8765432", TokenType.DecimalLiteral);
    testToken("765432", TokenType.DecimalLiteral);
    testToken("65432", TokenType.DecimalLiteral);
    testToken("5432", TokenType.DecimalLiteral);
    testToken("432", TokenType.DecimalLiteral);
    testToken("32", TokenType.DecimalLiteral);
    testToken("765_432", TokenType.DecimalLiteral);
    testToken("65_432", TokenType.DecimalLiteral);
    testToken("54_32_", TokenType.DecimalLiteral);
    testToken("765'432", TokenType.DecimalLiteral);
    testToken("65'432", TokenType.DecimalLiteral);
    testToken("54'32'", TokenType.DecimalLiteral);
    testToken("54_32'", TokenType.DecimalLiteral);
    testToken("54'32_", TokenType.DecimalLiteral);
    testToken("-1", TokenType.DecimalLiteral);
    testToken("-0", TokenType.DecimalLiteral);
    testToken("-9", TokenType.DecimalLiteral);
    testToken("-8765432", TokenType.DecimalLiteral);
    testToken("-765432", TokenType.DecimalLiteral);
    testToken("-65432", TokenType.DecimalLiteral);
    testToken("-5432", TokenType.DecimalLiteral);
    testToken("-432", TokenType.DecimalLiteral);
    testToken("-32", TokenType.DecimalLiteral);
    testToken("-765_432", TokenType.DecimalLiteral);
    testToken("-65_432", TokenType.DecimalLiteral);
    testToken("-54_32_", TokenType.DecimalLiteral);
    testToken("-765'432", TokenType.DecimalLiteral);
    testToken("-65'432", TokenType.DecimalLiteral);
    testToken("-54'32'", TokenType.DecimalLiteral);
    testToken("-54_32'", TokenType.DecimalLiteral);
    testToken("-54'32_", TokenType.DecimalLiteral);
  });

  it("Decimal literal #2", () => {
    testToken("765_4q32", TokenType.Argument);
    testToken("-765_4q32", TokenType.Argument);
    testToken("-_765_4*32", TokenType.Argument);
  });

  it("Option #1", () => {
    testToken("-a", TokenType.Option);
    testToken("-z", TokenType.Option);
    testToken("-A", TokenType.Option);
    testToken("-Z", TokenType.Option);
    testToken("-Z", TokenType.Option);
    testToken("-a0", TokenType.Option);
    testToken("-a9-", TokenType.Option);
    testToken("-a-", TokenType.Option);
    testToken("-a$", TokenType.Option);
    testToken("-a.", TokenType.Option);
    testToken("-a!", TokenType.Option);
    testToken("-a:", TokenType.Option);
    testToken("-a#", TokenType.Option);
    testToken("-project-root", TokenType.Option);
  });

  it("Option #2", () => {
    testToken("-a*", TokenType.Argument);
    testToken("-z\\", TokenType.Argument);
  });

  it("Identifier #1", () => {
    testToken("a", TokenType.Identifier);
    testToken("z", TokenType.Identifier);
    testToken("A", TokenType.Identifier);
    testToken("Z", TokenType.Identifier);
    testToken("Z", TokenType.Identifier);
    testToken("a0", TokenType.Identifier);
    testToken("a9-", TokenType.Identifier);
    testToken("a-", TokenType.Identifier);
    testToken("a$", TokenType.Identifier);
    testToken("a.", TokenType.Identifier);
    testToken("a!", TokenType.Identifier);
    testToken("a:", TokenType.Identifier);
    testToken("a#", TokenType.Identifier);
    testToken("project-root", TokenType.Identifier);
  });

  it("Identifier #2", () => {
    testToken("a-{", TokenType.Argument);
    testToken("a*", TokenType.Path);
    testToken("z\\", TokenType.Path);
  });
});

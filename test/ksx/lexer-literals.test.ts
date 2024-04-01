import "mocha";
import { expect } from "expect";
import { TokenType } from "@common/ksx/TokenType";
import { Lexer } from "@common/ksx/Lexer";
import { InputStream } from "@common/ksx/InputStream";

describe("KSX Lexer - literal", () => {
  const literalCases = [
    { src: "0", exp: TokenType.DecimalLiteral },
    { src: "1", exp: TokenType.DecimalLiteral },
    { src: "2", exp: TokenType.DecimalLiteral },
    { src: "3", exp: TokenType.DecimalLiteral },
    { src: "4", exp: TokenType.DecimalLiteral },
    { src: "5", exp: TokenType.DecimalLiteral },
    { src: "6", exp: TokenType.DecimalLiteral },
    { src: "7", exp: TokenType.DecimalLiteral },
    { src: "8", exp: TokenType.DecimalLiteral },
    { src: "9", exp: TokenType.DecimalLiteral },
    { src: "0123", exp: TokenType.DecimalLiteral },
    { src: "0_123", exp: TokenType.DecimalLiteral },
    { src: "123_456_678_912_345", exp: TokenType.DecimalLiteral },

    { src: "0x0", exp: TokenType.HexadecimalLiteral },
    { src: "0x_0", exp: TokenType.HexadecimalLiteral },
    { src: "0x0_0", exp: TokenType.HexadecimalLiteral },
    { src: "0x1_0", exp: TokenType.HexadecimalLiteral },
    { src: "0x12ac34", exp: TokenType.HexadecimalLiteral },
    { src: "0x12_ac34", exp: TokenType.HexadecimalLiteral },

    { src: "0b0", exp: TokenType.BinaryLiteral },
    { src: "0b_0", exp: TokenType.BinaryLiteral },
    { src: "0b0_0", exp: TokenType.BinaryLiteral },
    { src: "0b1_0", exp: TokenType.BinaryLiteral },
    { src: "0b011100110", exp: TokenType.BinaryLiteral },
    { src: "0b0111_0011_0", exp: TokenType.BinaryLiteral },

    { src: "0.0", exp: TokenType.RealLiteral },
    { src: "1.0", exp: TokenType.RealLiteral },
    { src: "2.1", exp: TokenType.RealLiteral },
    { src: "3.12", exp: TokenType.RealLiteral },
    { src: "4.123", exp: TokenType.RealLiteral },
    { src: "5.1234", exp: TokenType.RealLiteral },
    { src: "6.12345", exp: TokenType.RealLiteral },
    { src: "7.123_456", exp: TokenType.RealLiteral },
    { src: "8.12", exp: TokenType.RealLiteral },
    { src: "9.12", exp: TokenType.RealLiteral },
    { src: "01.0", exp: TokenType.RealLiteral },
    { src: "1_.0", exp: TokenType.RealLiteral },
    { src: "543_210.012_345_6", exp: TokenType.RealLiteral },

    { src: "0e0", exp: TokenType.RealLiteral },
    { src: "1e0", exp: TokenType.RealLiteral },
    { src: "2e0", exp: TokenType.RealLiteral },
    { src: "3e0", exp: TokenType.RealLiteral },
    { src: "4e0", exp: TokenType.RealLiteral },
    { src: "5e0", exp: TokenType.RealLiteral },
    { src: "6e0", exp: TokenType.RealLiteral },
    { src: "7e0", exp: TokenType.RealLiteral },
    { src: "8e0", exp: TokenType.RealLiteral },
    { src: "9e0", exp: TokenType.RealLiteral },
    { src: "123e0", exp: TokenType.RealLiteral },
    { src: "23_4e0", exp: TokenType.RealLiteral },
    { src: "123e13", exp: TokenType.RealLiteral },
    { src: "123e+13", exp: TokenType.RealLiteral },
    { src: "123e-13", exp: TokenType.RealLiteral },
    { src: "123.456e13", exp: TokenType.RealLiteral },
    { src: "123.45_6e+13", exp: TokenType.RealLiteral },
    { src: "123.4_56e-13", exp: TokenType.RealLiteral },

    { src: ".0", exp: TokenType.RealLiteral },
    { src: ".12_34", exp: TokenType.RealLiteral },
    { src: ".456e13", exp: TokenType.RealLiteral },
    { src: ".45_6e+13", exp: TokenType.RealLiteral },
    { src: ".4_56e-13", exp: TokenType.RealLiteral },

    { src: "true", exp: TokenType.True },
    { src: "false", exp: TokenType.False }
  ];
  literalCases.forEach(c => {
    it(`Token ${c.src} #1`, () => {
      const source = c.src;
      const wLexer = new Lexer(new InputStream(source));

      // --- Act
      const next = wLexer.get();

      // --- Assert
      expect(next.type).toEqual(c.exp);
      expect(next.text).toEqual(source);
      expect(next.location.startPosition).toEqual(0);
      expect(next.location.endPosition).toEqual(source.length);
      expect(next.location.startLine).toEqual(1);
      expect(next.location.endLine).toEqual(1);
      expect(next.location.startColumn).toEqual(0);
      expect(next.location.endColumn).toEqual(source.length);
    });

    it(`Token ${c.src} #2`, () => {
      const source = ` \t \r ${c.src}`;
      const wLexer = new Lexer(new InputStream(source));

      // --- Act
      const next = wLexer.get();

      // --- Assert
      expect(next.type).toEqual(c.exp);
      expect(next.text).toEqual(c.src);
      expect(next.location.startPosition).toEqual(5);
      expect(next.location.endPosition).toEqual(source.length);
      expect(next.location.startLine).toEqual(1);
      expect(next.location.endLine).toEqual(1);
      expect(next.location.startColumn).toEqual(5);
      expect(next.location.endColumn).toEqual(source.length);
    });

    it(`Token ${c.src} #3`, () => {
      const source = ` /* c */ ${c.src}`;
      const wLexer = new Lexer(new InputStream(source));

      // --- Act
      const next = wLexer.get();

      // --- Assert
      expect(next.type).toEqual(c.exp);
      expect(next.text).toEqual(c.src);
      expect(next.location.startPosition).toEqual(9);
      expect(next.location.endPosition).toEqual(source.length);
      expect(next.location.startLine).toEqual(1);
      expect(next.location.endLine).toEqual(1);
      expect(next.location.startColumn).toEqual(9);
      expect(next.location.endColumn).toEqual(source.length);
    });

    it(`Token ${c.src} #4`, () => {
      const source = `${c.src} \t \r `;
      const wLexer = new Lexer(new InputStream(source));

      // --- Act
      const next = wLexer.get();

      // --- Assert
      expect(next.type).toEqual(c.exp);
      expect(next.text).toEqual(c.src);
      expect(next.location.startPosition).toEqual(0);
      expect(next.location.endPosition).toEqual(c.src.length);
      expect(next.location.startLine).toEqual(1);
      expect(next.location.endLine).toEqual(1);
      expect(next.location.startColumn).toEqual(0);
      expect(next.location.endColumn).toEqual(c.src.length);
    });

    it(`Token ${c.src} #5`, () => {
      const source = `${c.src} // c`;
      const wLexer = new Lexer(new InputStream(source));

      // --- Act
      const next = wLexer.get();
      const trail1 = wLexer.get(true);
      const trail2 = wLexer.get(true);
      const trail3 = wLexer.get();

      // --- Assert
      expect(next.type).toEqual(c.exp);
      expect(next.text).toEqual(c.src);
      expect(next.location.startPosition).toEqual(0);
      expect(next.location.endPosition).toEqual(c.src.length);
      expect(next.location.startLine).toEqual(1);
      expect(next.location.endLine).toEqual(1);
      expect(next.location.startColumn).toEqual(0);
      expect(next.location.endColumn).toEqual(c.src.length);
      expect(trail1.type).toEqual(TokenType.Ws);
      expect(trail2.type).toEqual(TokenType.EolComment);
      expect(trail3.type).toEqual(TokenType.Eof);
    });
  });

  const errorCases = [
    "0.",
    "0e",
    "0E",
    "1.",
    "1e",
    "1E",
    "0e+",
    "0E+",
    "1e-",
    "1E+",

    "0x",
    "0b",
    "0x_",
    "0b_",

    '"',
    '"\r"',
    '"\n"',
    '"\u0085"',
    '"\u2028"',
    '"\u2029"'
  ];
  errorCases.forEach(c => {
    it(`Token error ${c} #1`, () => {
      const wLexer = new Lexer(new InputStream(c));

      // --- Act
      const next = wLexer.get();

      // --- Assert
      expect(next.type).toEqual(TokenType.Unknown);
    });
  });

  const stringCases: string[] = [
    '""',
    '"abc"',
    '"abc,def,1234:#"',
    '"\\bdef"',
    '"\\fdef"',
    '"\\ndef"',
    '"\\rdef"',
    '"\\tdef"',
    '"\\vdef"',
    '"\\0def"',
    '"\\\'def"',
    '"\\"def"',
    '"\\`def"',
    '"\\\\def"',
    '"\\qdef"',
    '"\\x40def"',
    '"abd\\bdef"',
    '"abd\\fdef"',
    '"abd\\ndef"',
    '"abd\\rdef"',
    '"abd\\tdef"',
    '"abd\\vdef"',
    '"abd\\0def"',
    '"abd\\\'def"',
    '"abd\\"def"',
    '"abd\\\\def"',
    '"abd\\qdef"',
    '"abd\\x40def"',
    '"abd\\b"',
    '"abd\\f"',
    '"abd\\n"',
    '"abd\\r"',
    '"abd\\t"',
    '"abd\\v"',
    '"abd\\S"',
    '"abd\\0"',
    '"abd\\\'"',
    '"abd\\""',
    '"abd\\\\"',
    '"abd\\q"',
    '"abd\\x40"',
    '"abd\\u1234"',

    "'abc'",
    "'abc,def,1234:#'",
    "'\\bdef'"
  ];
  stringCases.forEach((c, idx) => {
    it(`String #${idx + 1}: ${c}`, () => {
      // --- Arrange
      const wLexer = new Lexer(new InputStream(c));

      // --- Act
      const next = wLexer.get();

      // --- Assert
      expect(next.type).toEqual(TokenType.StringLiteral);
      expect(next.text).toEqual(c);
      expect(next.location.startPosition).toEqual(0);
      expect(next.location.endPosition).toEqual(c.length);
      expect(next.location.startLine).toEqual(1);
      expect(next.location.endLine).toEqual(1);
      expect(next.location.startColumn).toEqual(0);
      expect(next.location.endColumn).toEqual(c.length);
    });
  });
});

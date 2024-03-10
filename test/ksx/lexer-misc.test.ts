import "mocha";
import { expect } from "expect";
import { Lexer } from "@main/ksx/Lexer";
import { InputStream } from "@main/ksx/InputStream";
import { TokenType } from "@main/ksx/TokenType";

describe("KSX Lexer - miscellaneous", () => {
  it("Empty", () => {
    // --- Arrange
    const source = "";
    const wLexer = new Lexer(new InputStream(source));

    // --- Act
    const next = wLexer.get();

    // --- Assert
    expect(next.type).toEqual(TokenType.Eof);
    expect(next.text).toEqual(source);
    expect(next.location.startPosition).toEqual(0);
    expect(next.location.endPosition).toEqual(source.length);
    expect(next.location.startLine).toEqual(1);
    expect(next.location.endLine).toEqual(1);
    expect(next.location.startColumn).toEqual(0);
    expect(next.location.endColumn).toEqual(source.length);
  });

  const miscCases = [
    { src: "...", exp: TokenType.Spread },
    { src: ";", exp: TokenType.Semicolon },
    { src: "/", exp: TokenType.Divide },
    { src: "**", exp: TokenType.Exponent },
    { src: "*", exp: TokenType.Multiply },
    { src: "%", exp: TokenType.Remainder },
    { src: "+", exp: TokenType.Plus },
    { src: "-", exp: TokenType.Minus },
    { src: "^", exp: TokenType.BitwiseXor },
    { src: "|", exp: TokenType.BitwiseOr },
    { src: "||", exp: TokenType.LogicalOr },
    { src: "&", exp: TokenType.BitwiseAnd },
    { src: "&&", exp: TokenType.LogicalAnd },
    { src: ",", exp: TokenType.Comma },
    { src: "(", exp: TokenType.LParent },
    { src: ")", exp: TokenType.RParent },
    { src: ":", exp: TokenType.Colon },
    { src: "[", exp: TokenType.LSquare },
    { src: "]", exp: TokenType.RSquare },
    { src: "?", exp: TokenType.QuestionMark },
    { src: "??", exp: TokenType.NullCoalesce },
    { src: "?.", exp: TokenType.OptionalChaining },
    { src: "{", exp: TokenType.LBrace },
    { src: "}", exp: TokenType.RBrace },
    { src: "=", exp: TokenType.Assignment },
    { src: "==", exp: TokenType.Equal },
    { src: "===", exp: TokenType.StrictEqual },
    { src: "!", exp: TokenType.LogicalNot },
    { src: "!=", exp: TokenType.NotEqual },
    { src: "!==", exp: TokenType.StrictNotEqual },
    { src: "<", exp: TokenType.LessThan },
    { src: "<=", exp: TokenType.LessThanOrEqual },
    { src: "<<", exp: TokenType.ShiftLeft },
    { src: ">", exp: TokenType.GreaterThan },
    { src: ">=", exp: TokenType.GreaterThanOrEqual },
    { src: ">>", exp: TokenType.SignedShiftRight },
    { src: ">>>", exp: TokenType.ShiftRight },
    { src: ".", exp: TokenType.Dot },
    { src: "thisId", exp: TokenType.Identifier },
    { src: "_other145$", exp: TokenType.Identifier },
    { src: "$loader", exp: TokenType.Identifier },
    { src: "@extMethod", exp: TokenType.Identifier },
    { src: "#dummy", exp: TokenType.Identifier },
    { src: "Infinity", exp: TokenType.Infinity },
    { src: "NaN", exp: TokenType.NaN },
    { src: "true", exp: TokenType.True },
    { src: "false", exp: TokenType.False },
    { src: "#item", exp: TokenType.Identifier },
    { src: "null", exp: TokenType.Null },
    { src: "undefined", exp: TokenType.Undefined },
    { src: "in", exp: TokenType.In },
    { src: "+=", exp: TokenType.AddAssignment },
    { src: "-=", exp: TokenType.SubtractAssignment },
    { src: "**=", exp: TokenType.ExponentAssignment },
    { src: "*=", exp: TokenType.MultiplyAssignment },
    { src: "/=", exp: TokenType.DivideAssignment },
    { src: "%=", exp: TokenType.RemainderAssignment },
    { src: "<<=", exp: TokenType.ShiftLeftAssignment },
    { src: ">>=", exp: TokenType.SignedShiftRightAssignment },
    { src: ">>>=", exp: TokenType.ShiftRightAssignment },
    { src: "&=", exp: TokenType.BitwiseAndAssignment },
    { src: "&&=", exp: TokenType.LogicalAndAssignment },
    { src: "^=", exp: TokenType.BitwiseXorAssignment },
    { src: "|=", exp: TokenType.BitwiseOrAssignment },
    { src: "||=", exp: TokenType.LogicalOrAssignment },
    { src: "??=", exp: TokenType.NullCoalesceAssignment },
    { src: "=>", exp: TokenType.Arrow },
    { src: "++", exp: TokenType.IncOp },
    { src: "--", exp: TokenType.DecOp },
    { src: "let", exp: TokenType.Let },
    { src: "const", exp: TokenType.Const },
    { src: "if", exp: TokenType.If },
    { src: "else", exp: TokenType.Else },
    { src: "return", exp: TokenType.Return },
    { src: "break", exp: TokenType.Break },
    { src: "continue", exp: TokenType.Continue },
    { src: "do", exp: TokenType.Do },
    { src: "while", exp: TokenType.While },
    { src: "for", exp: TokenType.For },
    { src: "of", exp: TokenType.Of },
    { src: "try", exp: TokenType.Try },
    { src: "catch", exp: TokenType.Catch },
    { src: "finally", exp: TokenType.Finally },
    { src: "throw", exp: TokenType.Throw },
    { src: "switch", exp: TokenType.Switch },
    { src: "case", exp: TokenType.Case },
    { src: "default", exp: TokenType.Default },
    { src: "delete", exp: TokenType.Delete },
    { src: "function", exp: TokenType.Function }
  ];
  miscCases.forEach(c => {
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
});

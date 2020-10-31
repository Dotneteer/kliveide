import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/z80lang/parser/input-stream";
import { TokenStream } from "../../src/z80lang/parser/token-stream";
import { Z80AsmParser } from "../../src/z80lang/parser/z80-asm-parser";
import { IntegerLiteral, StringLiteral } from "../../src/z80lang/parser/tree-nodes";

describe("Parser - expression literals", () => {
  const binaryLiterals = [
    { source: "%0", expected: 0 },
    { source: "%1", expected: 1 },
    { source: "%1111_0000", expected: 0xf0 },
    { source: "%_1111_0000", expected: 0xf0 },
    { source: "%0000_0111_1111_0000", expected: 0x07f0 },
    { source: "0b", expected: 0 },
    { source: "1b", expected: 1 },
    { source: "11110000b", expected: 0xf0 },
    { source: "0000011111110000b", expected: 0x07f0 },
  ];

  binaryLiterals.forEach(({ source, expected }) => {
    it(`binary ${source}`, () => {
      testIntegerLiteral(source, expected);
    });
  });

  const octalLiterals = [
    { source: "0q", expected: 0 },
    { source: "1q", expected: 1 },
    { source: "7q", expected: 7 },
    { source: "765432q", expected: 256794 },
    { source: "1234q", expected: 668 },
    { source: "0Q", expected: 0 },
    { source: "1Q", expected: 1 },
    { source: "7Q", expected: 7 },
    { source: "765432Q", expected: 256794 },
    { source: "1234Q", expected: 668 },
    { source: "0o", expected: 0 },
    { source: "1o", expected: 1 },
    { source: "7o", expected: 7 },
    { source: "765432o", expected: 256794 },
    { source: "1234o", expected: 668 },
    { source: "0O", expected: 0 },
    { source: "1O", expected: 1 },
    { source: "7O", expected: 7 },
    { source: "765432O", expected: 256794 },
    { source: "1234O", expected: 668 },
  ];

  octalLiterals.forEach(({ source, expected }) => {
    it(`octal ${source}`, () => {
      testIntegerLiteral(source, expected);
    });
  });

  const decimalLiterals = [
    { source: "0", expected: 0 },
    { source: "1", expected: 1 },
    { source: "9", expected: 9 },
    { source: "65535", expected: 65535 },
    { source: "065535", expected: 65535 },
    { source: "987654321", expected: 987654321 },
  ];

  decimalLiterals.forEach(({ source, expected }) => {
    it(`decimal ${source}`, () => {
      testIntegerLiteral(source, expected);
    });
  });

  const hexadecimalLiterals = [
    { source: "0Bh", expected: 0x0b },
    { source: "#0", expected: 0 },
    { source: "#1", expected: 1 },
    { source: "#9", expected: 9 },
    { source: "#f", expected: 15 },
    { source: "#F", expected: 15 },
    { source: "#12ac", expected: 0x12ac },
    { source: "#ffe", expected: 0x0ffe },
    { source: "$0", expected: 0 },
    { source: "$1", expected: 1 },
    { source: "$9", expected: 9 },
    { source: "$f", expected: 15 },
    { source: "$F", expected: 15 },
    { source: "$12ac", expected: 0x12ac },
    { source: "$ffe", expected: 0x0ffe },
    { source: "0x0", expected: 0 },
    { source: "0x1", expected: 1 },
    { source: "0x9", expected: 9 },
    { source: "0xf", expected: 15 },
    { source: "0xF", expected: 15 },
    { source: "0x12ac", expected: 0x12ac },
    { source: "0xffe", expected: 0x0ffe },
    { source: "0h", expected: 0 },
    { source: "1h", expected: 1 },
    { source: "9h", expected: 9 },
    { source: "0fh", expected: 15 },
    { source: "0Fh", expected: 15 },
    { source: "12ach", expected: 0x12ac },
    { source: "0fffeh", expected: 0xfffe },
    { source: "0H", expected: 0 },
    { source: "1H", expected: 1 },
    { source: "9H", expected: 9 },
    { source: "0fH", expected: 15 },
    { source: "0FH", expected: 15 },
    { source: "12acH", expected: 0x12ac },
    { source: "0fffeH", expected: 0xfffe },
  ];

  hexadecimalLiterals.forEach(({ source, expected }) => {
    it(`decimal ${source}`, () => {
      testIntegerLiteral(source, expected);
    });
  });

  const realLiterals = [
    { source: ".0e0", expected: 0.0 },
    { source: "0e0", expected: 0 },
    { source: "0e+0", expected: 0 },
    { source: "0e-0", expected: 0 },
    { source: "0e+12", expected: 0e12 },
    { source: "0e-23", expected: 0e-23 },
    { source: "0.0e0", expected: 0.0 },
    { source: "0.1e+0", expected: 0.1 },
    { source: "0.2e-0", expected: 0.2 },
    { source: "0.3e+12", expected: 0.3e12 },
    { source: "0.4e-23", expected: 0.4e-23 },
    { source: "0.134e+0", expected: 0.134 },
    { source: "0.245e-0", expected: 0.245 },
    { source: "0.356e+12", expected: 0.356e12 },
    { source: "0.467e-23", expected: 0.467e-23 },
    { source: "1e0", expected: 1 },
    { source: "1e+0", expected: 1 },
    { source: "1e-0", expected: 1 },
    { source: "1e+12", expected: 1e12 },
    { source: "1e-23", expected: 1e-23 },
    { source: "1.0e0", expected: 1.0 },
    { source: "1.1e+0", expected: 1.1 },
    { source: "1.2e-0", expected: 1.2 },
    { source: "1.3e+12", expected: 1.3e12 },
    { source: "1.4e-23", expected: 1.4e-23 },
    { source: "1.134e+0", expected: 1.134 },
    { source: "1.245e-0", expected: 1.245 },
    { source: "1.356e+12", expected: 1.356e12 },
    { source: "1.467e-23", expected: 1.467e-23 },
    { source: "781e+12", expected: 781e12 },
    { source: "121e-23", expected: 121e-23 },
    { source: "121.0e0", expected: 121.0 },
    { source: "231.1e+0", expected: 231.1 },
    { source: "341.2e-0", expected: 341.2 },
    { source: "451.3e+12", expected: 451.3e12 },
    { source: "561.4e-23", expected: 561.4e-23 },
    { source: "671.023e0", expected: 671.023 },
    { source: ".1e+0", expected: 0.1 },
    { source: ".2e-0", expected: 0.2 },
    { source: ".3e+12", expected: 0.3e12 },
    { source: ".4e-23", expected: 0.4e-23 },
    { source: ".023e0", expected: 0.023 },
    { source: ".134e+0", expected: 0.134 },
    { source: ".245e-0", expected: 0.245 },
    { source: ".356e+12", expected: 0.356e12 },
    { source: ".467e-23", expected: 0.467e-23 },
  ];

  realLiterals.forEach(({ source, expected }) => {
    it(`real ${source}`, () => {
      testRealLiteral(source, expected);
    });
  });

  const stringLiterals = [
    { source: "a", expected: ["a"] },
    {
      source: "abcd1234,",
      expected: ["a", "b", "c", "d", "1", "2", "3", "4", ","],
    },
    {
      source: "a\\\\b",
      expected: ["a", "\\", "b"],
    },
    {
      source: "\\\\b",
      expected: ["\\", "b"],
    },
    {
      source: "a\\\\",
      expected: ["a", "\\"],
    },
    {
      source: "ab\\K",
      expected: ["a", "b", "K"],
    },
    {
      source: "a\\'b",
      expected: ["a", "'", "b"],
    },
    {
      source: "\\'b",
      expected: ["'", "b"],
    },
    {
      source: "a\\'",
      expected: ["a", "'"],
    },
    {
      source: 'a\\"b',
      expected: ["a", '"', "b"],
    },
    {
      source: '\\"b',
      expected: ['"', "b"],
    },
    {
      source: 'a\\"',
      expected: ["a", '"'],
    },
    {
      source: "a\\ib",
      expected: ["a", 0x10, "b"],
    },
    {
      source: "\\ib",
      expected: [0x10, "b"],
    },
    {
      source: "a\\i",
      expected: ["a", 0x10],
    },
    {
      source: "a\\pb",
      expected: ["a", 0x11, "b"],
    },
    {
      source: "\\pb",
      expected: [0x11, "b"],
    },
    {
      source: "a\\p",
      expected: ["a", 0x11],
    },
    {
      source: "a\\fb",
      expected: ["a", 0x12, "b"],
    },
    {
      source: "\\fb",
      expected: [0x12, "b"],
    },
    {
      source: "a\\f",
      expected: ["a", 0x12],
    },
    {
      source: "a\\bb",
      expected: ["a", 0x13, "b"],
    },
    {
      source: "\\bb",
      expected: [0x13, "b"],
    },
    {
      source: "a\\b",
      expected: ["a", 0x13],
    },
    {
      source: "a\\Ib",
      expected: ["a", 0x14, "b"],
    },
    {
      source: "\\Ib",
      expected: [0x14, "b"],
    },
    {
      source: "a\\I",
      expected: ["a", 0x14],
    },
    {
      source: "a\\ob",
      expected: ["a", 0x15, "b"],
    },
    {
      source: "\\ob",
      expected: [0x15, "b"],
    },
    {
      source: "a\\o",
      expected: ["a", 0x15],
    },
    {
      source: "a\\ab",
      expected: ["a", 0x16, "b"],
    },
    {
      source: "\\ab",
      expected: [0x16, "b"],
    },
    {
      source: "a\\a",
      expected: ["a", 0x16],
    },
    {
      source: "a\\tb",
      expected: ["a", 0x17, "b"],
    },
    {
      source: "\\tb",
      expected: [0x17, "b"],
    },
    {
      source: "a\\t",
      expected: ["a", 0x17],
    },
    {
      source: "a\\Pb",
      expected: ["a", 0x60, "b"],
    },
    {
      source: "\\Pb",
      expected: [0x60, "b"],
    },
    {
      source: "a\\P",
      expected: ["a", 0x60],
    },
    {
      source: "a\\Cb",
      expected: ["a", 0x7f, "b"],
    },
    {
      source: "\\Cb",
      expected: [0x7f, "b"],
    },
    {
      source: "a\\C",
      expected: ["a", 0x7f],
    },
    {
      source: "a\\0b",
      expected: ["a", 0x00, "b"],
    },
    {
      source: "\\0b",
      expected: [0x00, "b"],
    },
    {
      source: "a\\0",
      expected: ["a", 0x00],
    },
    {
      source: "a\\x01Q",
      expected: ["a", 0x01, "Q"],
    },
    {
      source: "\\x01Q",
      expected: [0x01, "Q"],
    },
    {
      source: "a\\x01",
      expected: ["a", 0x01],
    },
    {
      source: "a\\xa3Q",
      expected: ["a", 0xa3, "Q"],
    },
    {
      source: "\\xA3Q",
      expected: [0xa3, "Q"],
    },
    {
      source: "a\\xa3",
      expected: ["a", 0xa3],
    },
    {
      source: "a\\x1c4Q",
      expected: ["a", 0x1c, "4", "Q"],
    },
  ];

  stringLiterals.forEach(({ source, expected }) => {
    it(`string "${source}"`, () => {
      testStringLiteral(source, ...expected);
    });
  });

  const charLiterals = [
    { source: "a", expected: "a" },
    {
      source: "\\\\",
      expected: "\\",
    },
    {
      source: "\\'",
      expected: "'",
    },
    {
      source: '\\"',
      expected: '"',
    },
    {
      source: "\\i",
      expected: 0x10,
    },
    {
      source: "\\p",
      expected: 0x11,
    },
    {
      source: "\\f",
      expected: 0x12,
    },
    {
      source: "\\b",
      expected: 0x13,
    },
    {
      source: "\\I",
      expected: 0x14,
    },
    {
      source: "\\o",
      expected: 0x15,
    },
    {
      source: "\\a",
      expected: 0x16,
    },
    {
      source: "\\t",
      expected: 0x17,
    },
    {
      source: "\\P",
      expected: 0x60,
    },
    {
      source: "\\C",
      expected: 0x7f,
    },
    {
      source: "\\0",
      expected: 0x00,
    },
    {
      source: "\\x01",
      expected: 0x01,
    },
    {
      source: "\\xa3",
      expected: 0xa3,
    },
  ];

  charLiterals.forEach(({ source, expected }) => {
    it(`char '${source}'`, () => {
      testCharLiteral(source, expected);
    });
  });

  const curAddrLiterals = ["$", ".", "*"];
  curAddrLiterals.forEach((source) => {
    it(`curadr ${source}`, () => {
      const parser = createParser(source);
      const parsed = parser.parseExpr();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.type === "CurrentAddressLiteral").toBe(true);
    });
  });

  const curCntLiterals = ["$cnt", ".cnt", "$CNT", ".CNT"];
  curCntLiterals.forEach((source) => {
    it(`curcnt ${source}`, () => {
      const parser = createParser(source);
      const parsed = parser.parseExpr();
      expect(parser.hasErrors).toBe(false);
      expect(parsed).not.toBeNull();
      expect(parsed.type === "CurrentCounterLiteral").toBe(true);
    });
  });

});

function testIntegerLiteral(source: string, expected: number): void {
  const parser = createParser(source);
  const parsed = parser.parseExpr();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.type === "IntegerLiteral").toBe(true);
  const literal = parsed as IntegerLiteral;
  expect(literal.value).toBe(expected);
}

function testRealLiteral(source: string, expected: number): void {
  const parser = createParser(source);
  const parsed = parser.parseExpr();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.type === "RealLiteral").toBe(true);
  const literal = parsed as IntegerLiteral;
  expect(literal.value).toBe(expected);
}

function testStringLiteral(
  source: string,
  ...chars: (number | string)[]
): void {
  const parser = createParser(`"${source}"`);
  const parsed = parser.parseExpr();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.type === "StringLiteral").toBe(true);
  const literal = parsed as StringLiteral;
  for (let i = 0; i < literal.value.length; i++) {
    const code = literal.value.charCodeAt(i);
    if (typeof chars[i] === "string") {
      expect((chars[i] as string).charCodeAt(0)).toBe(code);
    } else {
      expect(chars[i]).toBe(code);
    }
  }
}

function testCharLiteral(source: string, char: number | string): void {
  const parser = createParser(`'${source}'`);
  const parsed = parser.parseExpr();
  expect(parser.hasErrors).toBe(false);
  expect(parsed).not.toBeNull();
  expect(parsed.type === "IntegerLiteral").toBe(true);
  const literal = parsed as StringLiteral;
  const code = literal.value;
  if (typeof char === "string") {
    expect((char as string).charCodeAt(0)).toBe(code);
  } else {
    expect(char).toBe(code);
  }
}

function createParser(source: string): Z80AsmParser {
  const is = new InputStream(source);
  const ts = new TokenStream(is);
  return new Z80AsmParser(ts);
}

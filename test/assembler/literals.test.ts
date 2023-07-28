import "mocha";
import { expect } from "expect";
import { Z80Assembler } from "../../src/electron/z80-compiler/assembler";
import { AssemblerOptions } from "../../src/electron/z80-compiler/assembler-in-out";
import { SymbolValueMap } from "../../src/electron/z80-compiler/assembler-types";

describe("Assembler - literals", async () => {
  const decimalLiterals = [
    { source: "0", value: 0 },
    { source: "12345", value: 12345 },
    { source: "99999", value: 34463 }
  ];
  decimalLiterals.forEach(lit => {
    it(`Decimal literal ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const hexadecimalLiterals = [
    { source: "#0", value: 0 },
    { source: "0H", value: 0 },
    { source: "#12AC", value: 0x12ac },
    { source: "$12AC", value: 0x12ac },
    { source: "0F78AH", value: 0xf78a },
    { source: "78AFH", value: 0x78af },
    { source: "0F78Ah", value: 0xf78a },
    { source: "78AFh", value: 0x78af }
  ];
  hexadecimalLiterals.forEach(lit => {
    it(`Hexadecimal literal ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const binaryLiterals = [
    { source: "%0", value: 0 },
    { source: "%1", value: 1 },
    { source: "%10101010", value: 0xaa },
    { source: "%1010101001010101", value: 0xaa55 },
    { source: "%1010_1010", value: 0xaa },
    { source: "%101_010_100_101_0101", value: 0xaa55 }
  ];
  binaryLiterals.forEach(lit => {
    it(`Binary literal ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const octalLiterals = [
    { source: "0o", value: 0 },
    { source: "17O", value: 15 },
    { source: "77777q", value: 32767 },
    { source: "111111Q", value: 37449 }
  ];
  octalLiterals.forEach(lit => {
    it(`Octal literal ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const realLiterals = [
    { source: "0.0", value: 0 },
    { source: "3.14", value: 3 },
    { source: "0.25", value: 0 },
    { source: "3.14E2", value: 3.14e2 },
    { source: "3.14E+2", value: 3.14e2 },
    { source: "3.14e-2", value: 0 },
    { source: "1e8", value: 57600 },
    { source: "2e+8", value: 49664 },
    { source: "3e-8", value: 0 },
    { source: "3e-188888", value: 0 }
  ];
  realLiterals.forEach(lit => {
    it(`Real literal ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });
});

async function testExpression (
  source: string,
  value: number | boolean | string | null,
  symbols?: SymbolValueMap
): Promise<void> {
  const compiler = new Z80Assembler();
  const options = new AssemblerOptions();
  if (symbols) {
    options.predefinedSymbols = symbols;
  }

  const output = await compiler.compile(`MySymbol .equ ${source}`, options);

  expect(output.errorCount).toBe(0);
  expect(output.segments.length).toBe(1);
  const symbol = output.getSymbol("MySymbol");
  expect(symbol).toBeDefined();
  if (!symbol) {
    return;
  }
  expect(symbol.value).toBeDefined();
  if (!symbol.value) {
    return;
  }

  if (value === null) {
    expect(symbol.value.isValid).toBe(false);
  } else {
    expect(symbol.value.value).toBe(value);
  }
}

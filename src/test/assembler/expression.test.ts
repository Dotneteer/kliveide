import "mocha";
import { ExpressionValue } from "../../main/z80-compiler/expressions";
import { expressionFails, testExpression } from "./test-helpers";
import { SymbolValueMap } from "../../main/z80-compiler/assembler-types";

describe("Assembler - expressions", async () => {
  it("Known symbol evaluates to its value", async () => {
    const symbols: SymbolValueMap = {
      known: new ExpressionValue(0x23ea),
    };
    await testExpression("known", 0x23ea, symbols);
  });

  const unarySamples = [
    { source: "+0", value: 0 },
    { source: "+12345", value: 12345 },
    { source: "+99999", value: 99999 },
    { source: "+false", value: 0 },
    { source: "+true", value: 1 },
    { source: "+0.0", value: 0 },
    { source: "+3.14", value: 3 },
    { source: "+0.25", value: 0 },
    { source: "+3.14E2", value: 3.14e2 },
    { source: "+3.14E+2", value: 3.14e2 },
    { source: "+3.14e-2", value: 0 },
    { source: "+1e8", value: 1e8 },
    { source: "+2e+8", value: 2e8 },
    { source: "+3e-8", value: 0 },
    { source: "+3e-188888", value: 0 },
    { source: "-0", value: -0 },
    { source: "-12345", value: -12345 },
    { source: "-99999", value: -99999 },
    { source: "-false", value: -0 },
    { source: "-true", value: -1 },
    { source: "-0.0", value: -0 },
    { source: "-3.14", value: -3.14 },
    { source: "-0.25", value: -0.25 },
    { source: "-3.14E2", value: -3.14e2 },
    { source: "-3.14E+2", value: -3.14e2 },
    { source: "-3.14e-2", value: -3.14e-2 },
    { source: "-1e8", value: -1e8 },
    { source: "-2e+8", value: -2e8 },
    { source: "-3e-8", value: -3e-8 },
    { source: "-3e-188888", value: -0 },
    { source: "~0", value: -1 },
    { source: "~#aa55", value: -43606 },
    { source: "~true", value: -2 },
    { source: "~false", value: -1 },
    { source: "!0", value: 1 },
    { source: "!#aa55", value: 0 },
    { source: "!true", value: 0 },
    { source: "!false", value: 1 },
  ];
  unarySamples.forEach((lit) => {
    it(`Unary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const unaryFails = [
    { source: "~3.14", pattern: "integral types" },
    { source: '~"abc"', pattern: "integral types" },
    { source: "!3.14", pattern: "integral types" },
    { source: '!"abc"', pattern: "integral types" },
  ];
  unaryFails.forEach((lit) => {
    it(`Unary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const minOpSamples = [
    { source: "0 <? 3", value: 0 },
    { source: "23 <? 12", value: 12 },
    { source: "#8000 <? #4000", value: 0x4000 },
    { source: "false <? false", value: 0 },
    { source: "false <? true", value: 0 },
    { source: "true <? false", value: 0 },
    { source: "true <? true", value: 1 },
    { source: "false <? 123", value: 0 },
    { source: "123 <? false", value: 0 },
    { source: "true <? 123", value: 1 },
    { source: "123 <? true", value: 1 },
    { source: "0.0 <? 3.14", value: 0 },
    { source: "1e1 <? 2e1", value: 1e1 },
    { source: "1.2 <? 3.14e-1", value: 0 },
    { source: "0.0 <? 3", value: 0 },
    { source: "1e1 <? 20", value: 1e1 },
    { source: "1.2 <? 1", value: 1 },
    { source: "3 <? 0.0", value: 0 },
    { source: "20 <? 1e1", value: 1e1 },
    { source: "1 <? 1.2", value: 1 },
    { source: "0.0 <? false", value: 0 },
    { source: "1e1 <? true", value: 1 },
    { source: "1.2 <? true", value: 1 },
    { source: "false <? 0.0", value: 0 },
    { source: "true <? 1e1", value: 1 },
    { source: "false <? 1.2", value: 0 },
  ];
  minOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const minOpFails = [
    { source: 'true <? "abc"', pattern: "cannot be a string" },
    { source: '1 <? "abc"', pattern: "cannot be a string" },
    { source: '1.1 <? "abc"', pattern: "cannot be a string" },
    { source: '"abc" <? false', pattern: "cannot be a string" },
    { source: '"abc" <? 1', pattern: "cannot be a string" },
    { source: '"abc" <? 1.1', pattern: "cannot be a string" },
    { source: '"abc" <? "def"', pattern: "cannot be a string" },
  ];
  minOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const maxOpSamples = [
    { source: "0 >? 3", value: 3 },
    { source: "23 >? 12", value: 23 },
    { source: "#8000 >? #4000", value: 0x8000 },
    { source: "false >? false", value: 0 },
    { source: "false >? true", value: 1 },
    { source: "true >? false", value: 1 },
    { source: "true >? true", value: 1 },
    { source: "false >? 123", value: 123 },
    { source: "123 >? false", value: 123 },
    { source: "true >? 123", value: 123 },
    { source: "123 >? true", value: 123 },
    { source: "0.0 >? 3.14", value: 3 },
    { source: "1e1 >? 2e1", value: 2e1 },
    { source: "1.2 >? 3.14e-1", value: 1 },
    { source: "0.0 >? 3", value: 3 },
    { source: "1e1 >? 20", value: 20 },
    { source: "1.2 >? 1", value: 1 },
    { source: "3 >? 0.0", value: 3 },
    { source: "20 >? 1e1", value: 20 },
    { source: "1 >? 1.2", value: 1 },
    { source: "0.0 >? false", value: 0 },
    { source: "1e1 >? true", value: 1e1 },
    { source: "1.2 >? true", value: 1 },
    { source: "false >? 0.0", value: 0 },
    { source: "true >? 1e1", value: 1e1 },
    { source: "false >? 1.2", value: 1 },
  ];
  maxOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const maxOpFails = [
    { source: 'true >? "abc"', pattern: "cannot be a string" },
    { source: '1 >? "abc"', pattern: "cannot be a string" },
    { source: '1.1 >? "abc"', pattern: "cannot be a string" },
    { source: '"abc" >? false', pattern: "cannot be a string" },
    { source: '"abc" >? 1', pattern: "cannot be a string" },
    { source: '"abc" >? 1.1', pattern: "cannot be a string" },
    { source: '"abc" >? "def"', pattern: "cannot be a string" },
  ];
  maxOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const mulOpSamples = [
    { source: "0 * 3", value: 0 },
    { source: "23 * 12", value: 276 },
    { source: "#8010 * #4014", value: 537788736 },
    { source: "false * false", value: 0 },
    { source: "false * true", value: 0 },
    { source: "true * false", value: 0 },
    { source: "true * true", value: 1 },
    { source: "false * 123", value: 0 },
    { source: "123 * false", value: 0 },
    { source: "true * 123", value: 123 },
    { source: "123 * true", value: 123 },
    { source: "0.0 * 3.14", value: 0 },
    { source: "1e1 * 2e1", value: 200 },
    { source: "1.5 * 3.14e-1", value: 0 },
    { source: "0.0 * 3", value: 0 },
    { source: "1e1 * 20", value: 200 },
    { source: "1.2 * 1", value: 1 },
    { source: "3 * 0.0", value: 0 },
    { source: "20 * 1e1", value: 200 },
    { source: "1 * 1.2", value: 1 },
    { source: "0.0 * false", value: 0 },
    { source: "1e1 * true", value: 1e1 },
    { source: "1.2 * true", value: 1 },
    { source: "false * 0.0", value: 0 },
    { source: "true * 1e1", value: 1e1 },
    { source: "false * 1.2", value: 0 },
  ];
  mulOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const mulOpFails = [
    { source: 'true * "abc"', pattern: "cannot be a string" },
    { source: '1 * "abc"', pattern: "cannot be a string" },
    { source: '1.1 * "abc"', pattern: "cannot be a string" },
    { source: '"abc" * false', pattern: "cannot be a string" },
    { source: '"abc" * 1', pattern: "cannot be a string" },
    { source: '"abc" * 1.1', pattern: "cannot be a string" },
    { source: '"abc" * "def"', pattern: "cannot be a string" },
  ];
  mulOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const divOpSamples = [
    { source: "0 / 3", value: 0 },
    { source: "23 / 12", value: 1 },
    { source: "#8010 / #1008", value: 7 },
    { source: "false / true", value: 0 },
    { source: "true / true", value: 1 },
    { source: "false / 123", value: 0 },
    { source: "true / 123", value: 0 },
    { source: "123 / true", value: 123 },
    { source: "0.0 / 3.14", value: 0 },
    { source: "2e1 / 1e1", value: 2 },
    { source: "1.5 / 3.14e-1", value: 4 },
    { source: "0.0 / 3", value: 0 },
    { source: "2e1 / 10", value: 2 },
    { source: "1.2 / 1", value: 1 },
    { source: "20 / 1e1", value: 2 },
    { source: "1 / 1.2", value: 0 },
    { source: "1e1 / true", value: 1e1 },
    { source: "1.2 / true", value: 1 },
    { source: "true / 1e1", value: 0 },
    { source: "false / 1.2", value: 0 },
  ];
  divOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const divOpFails = [
    { source: 'true / "abc"', pattern: "cannot be a string" },
    { source: '1 / "abc"', pattern: "cannot be a string" },
    { source: '1.1 / "abc"', pattern: "cannot be a string" },
    { source: '"abc" / 1', pattern: "cannot be a string" },
    { source: '"abc" / 1.1', pattern: "cannot be a string" },
    { source: '"abc" / "def"', pattern: "cannot be a string" },
  ];
  divOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const modOpSamples = [
    { source: "0 % 3", value: 0 },
    { source: "23 % 12", value: 11 },
    { source: "#8010 % #1008", value: 4056 },
    { source: "false % true", value: 0 },
    { source: "true % true", value: 0 },
    { source: "false % 123", value: 0 },
    { source: "true % 123", value: 1 },
    { source: "123 % true", value: 0 },
    { source: "2e1 % 1e1", value: 0 },
    { source: "2e1 % 10", value: 0 },
    { source: "20 % 1e1", value: 0 },
    { source: "1e1 % true", value: 0 },
    { source: "true % 1e1", value: 1 },
  ];
  modOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const modOpFails = [
    { source: 'true % "abc"', pattern: "cannot be a string" },
    { source: '1 % "abc"', pattern: "cannot be a string" },
    { source: '1.1 % "abc"', pattern: "cannot be a string" },
    { source: '"abc" % 1', pattern: "cannot be a string" },
    { source: '"abc" % 1.1', pattern: "cannot be a string" },
    { source: '"abc" % "def"', pattern: "cannot be a string" },
  ];
  modOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const addOpSamples = [
    { source: "0 + 3", value: 3 },
    { source: "23 + 12", value: 35 },
    { source: "#8010 + #1008", value: 36888 },
    { source: "false + true", value: 1 },
    { source: "true + true", value: 2 },
    { source: "false + 123", value: 123 },
    { source: "true + 123", value: 124 },
    { source: "123 + true", value: 124 },
    { source: "2e1 + 1e1", value: 30 },
    { source: "2e1 + 10", value: 30 },
    { source: "20 + 1e1", value: 30 },
    { source: "1e1 + true", value: 11 },
    { source: "true + 1e1", value: 11 },
    { source: "0.0 + 3.14", value: 3 },
    { source: '"abc" + "def"', value: "abcdef" },
    { source: '"abc" + ""', value: "abc" },
    { source: '"" + "def"', value: "def" },
  ];
  addOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const addOpFails = [
    { source: 'true + "abc"', pattern: "add an integral value" },
    { source: '"abc" + false', pattern: "string can be added" },
    { source: '1 + "abc"', pattern: "add an integral value" },
    { source: '1.1 + "abc"', pattern: "add an integral value" },
    { source: '"abc" + 1', pattern: "string can be added" },
    { source: '"abc" + 1.1', pattern: "string can be added" },
  ];
  addOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const subtOpSamples = [
    { source: "0 - 3", value: -3 },
    { source: "23 - 12", value: 11 },
    { source: "#8010 - #1008", value: 28680 },
    { source: "false - true", value: -1 },
    { source: "true - true", value: 0 },
    { source: "false - 123", value: -123 },
    { source: "true - 123", value: -122 },
    { source: "123 - true", value: 122 },
    { source: "2e1 - 1e1", value: 10 },
    { source: "2e1 - 10", value: 10 },
    { source: "20 - 1e1", value: 10 },
    { source: "1e1 - true", value: 9 },
    { source: "true - 1e1", value: -9 },
    { source: "0.0 - 3.14", value: -3.14 },
  ];
  subtOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const subtOpFails = [
    { source: 'true - "abc"', pattern: "right" },
    { source: '"abc" - false', pattern: "left" },
    { source: '1 - "abc"', pattern: "right" },
    { source: '1.1 - "abc"', pattern: "right" },
    { source: '"abc" - 1', pattern: "left" },
    { source: '"abc" - 1.1', pattern: "left" },
  ];
  subtOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const lshiftOpSamples = [
    { source: "0 << 3", value: 0 },
    { source: "23 << 12", value: 94208 },
    { source: "#8010 << #1008", value: 8392704 },
    { source: "false << true", value: 0 },
    { source: "true << true", value: 2 },
    { source: "false << 123", value: 0 },
    { source: "true << 123", value: 134217728 },
    { source: "123 << true", value: 246 },
    { source: "2e1 << 1e1", value: 20480 },
    { source: "2e1 << 10", value: 20480 },
    { source: "20 << 1e1", value: 20480 },
    { source: "1e1 << true", value: 20 },
    { source: "true << 1e1", value: 1024 },
  ];
  lshiftOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const lshiftOpFails = [
    { source: 'true << "abc"', pattern: "right" },
    { source: '"abc" << false', pattern: "left" },
    { source: '1 << "abc"', pattern: "right" },
    { source: '1.1 << "abc"', pattern: "left" },
    { source: '"abc" << 1', pattern: "left" },
    { source: '"abc" << 1.1', pattern: "left" },
  ];
  lshiftOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const rshiftOpSamples = [
    { source: "0 >> 3", value: 0 },
    { source: "23 >> 12", value: 0 },
    { source: "#8010 >> #1008", value: 128 },
    { source: "false >> true", value: 0 },
    { source: "true >> true", value: 0 },
    { source: "false >> 123", value: 0 },
    { source: "true >> 123", value: 0 },
    { source: "123 >> true", value: 61 },
    { source: "2e1 >> 1e1", value: 0 },
    { source: "2e1 >> 10", value: 0 },
    { source: "20 >> 1e1", value: 0 },
    { source: "1e1 >> true", value: 5 },
    { source: "true >> 1e1", value: 0 },
  ];
  rshiftOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const rshiftOpFails = [
    { source: 'true >> "abc"', pattern: "right" },
    { source: '"abc" >> false', pattern: "left" },
    { source: '1 >> "abc"', pattern: "right" },
    { source: '1.1 >> "abc"', pattern: "left" },
    { source: '"abc" >> 1', pattern: "left" },
    { source: '"abc" >> 1.1', pattern: "left" },
  ];
  rshiftOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const ltOpSamples = [
    { source: "0 < 3", value: 1 },
    { source: "23 < 12", value: 0 },
    { source: "#8010 < #1008", value: 0 },
    { source: "false < true", value: 1 },
    { source: "true < true", value: 0 },
    { source: "false < 123", value: 1 },
    { source: "true < 123", value: 1 },
    { source: "123 < true", value: 0 },
    { source: "2e1 < 1e1", value: 0 },
    { source: "2e1 < 10", value: 0 },
    { source: "20 < 1e1", value: 0 },
    { source: "1e1 < true", value: 0 },
    { source: "true < 1e1", value: 1 },
    { source: '"def" < "abc"', value: 0 },
    { source: '"abc" < "abc"', value: 0 },
    { source: '"abc" < "def"', value: 1 },
    { source: '"" < "def"', value: 1 },
    { source: '"" < ""', value: 0 },
  ];
  ltOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const ltOpFails = [
    { source: 'true < "abc"', pattern: "number" },
    { source: '"abc" < false', pattern: "another" },
    { source: '1 < "abc"', pattern: "number" },
    { source: '1.1 < "abc"', pattern: "number" },
    { source: '"abc" < 1', pattern: "another" },
    { source: '"abc" < 1.1', pattern: "another" },
  ];
  ltOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const lteOpSamples = [
    { source: "0 <= 3", value: 1 },
    { source: "23 <= 12", value: 0 },
    { source: "#8010 <= #1008", value: 0 },
    { source: "false <= true", value: 1 },
    { source: "true <= true", value: 1 },
    { source: "false <= 123", value: 1 },
    { source: "true <= 123", value: 1 },
    { source: "123 <= true", value: 0 },
    { source: "2e1 <= 1e1", value: 0 },
    { source: "2e1 <= 10", value: 0 },
    { source: "20 <= 1e1", value: 0 },
    { source: "1e1 <= true", value: 0 },
    { source: "true <= 1e1", value: 1 },
    { source: '"def" <= "abc"', value: 0 },
    { source: '"abc" <= "abc"', value: 1 },
    { source: '"abc" <= "def"', value: 1 },
    { source: '"" <= "def"', value: 1 },
    { source: '"" <= ""', value: 1 },
  ];
  lteOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const lteOpFails = [
    { source: 'true <= "abc"', pattern: "number" },
    { source: '"abc" <= false', pattern: "another" },
    { source: '1 <= "abc"', pattern: "number" },
    { source: '1.1 <= "abc"', pattern: "number" },
    { source: '"abc" <= 1', pattern: "another" },
    { source: '"abc" <= 1.1', pattern: "another" },
  ];
  lteOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const gteOpSamples = [
    { source: "0 >= 3", value: 0 },
    { source: "23 >= 12", value: 1 },
    { source: "#8010 >= #1008", value: 1 },
    { source: "false >= true", value: 0 },
    { source: "true >= true", value: 1 },
    { source: "false >= 123", value: 0 },
    { source: "true >= 123", value: 0 },
    { source: "123 >= true", value: 1 },
    { source: "2e1 >= 1e1", value: 1 },
    { source: "2e1 >= 10", value: 1 },
    { source: "20 >= 1e1", value: 1 },
    { source: "1e1 >= true", value: 1 },
    { source: "true >= 1e1", value: 0 },
    { source: '"def" >= "abc"', value: 1 },
    { source: '"abc" >= "abc"', value: 1 },
    { source: '"abc" >= "def"', value: 0 },
    { source: '"" >= "def"', value: 0 },
    { source: '"" >= ""', value: 1 },
  ];
  gteOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const gteOpFails = [
    { source: 'true >= "abc"', pattern: "number" },
    { source: '"abc" >= false', pattern: "another" },
    { source: '1 >= "abc"', pattern: "number" },
    { source: '1.1 >= "abc"', pattern: "number" },
    { source: '"abc" >= 1', pattern: "another" },
    { source: '"abc" >= 1.1', pattern: "another" },
  ];
  gteOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const gtOpSamples = [
    { source: "0 > 3", value: 0 },
    { source: "23 > 12", value: 1 },
    { source: "#8010 > #1008", value: 1 },
    { source: "false > true", value: 0 },
    { source: "true > true", value: 0 },
    { source: "false > 123", value: 0 },
    { source: "true > 123", value: 0 },
    { source: "123 > true", value: 1 },
    { source: "2e1 > 1e1", value: 1 },
    { source: "2e1 > 10", value: 1 },
    { source: "20 > 1e1", value: 1 },
    { source: "1e1 > true", value: 1 },
    { source: "true > 1e1", value: 0 },
    { source: '"def" > "abc"', value: 1 },
    { source: '"abc" > "abc"', value: 0 },
    { source: '"abc" > "def"', value: 0 },
    { source: '"" > "def"', value: 0 },
    { source: '"" > ""', value: 0 },
  ];
  gtOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const gtOpFails = [
    { source: 'true > "abc"', pattern: "number" },
    { source: '"abc" > false', pattern: "another" },
    { source: '1 > "abc"', pattern: "number" },
    { source: '1.1 > "abc"', pattern: "number" },
    { source: '"abc" > 1', pattern: "another" },
    { source: '"abc" > 1.1', pattern: "another" },
  ];
  gtOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const eqOpSamples = [
    { source: "0 == 3", value: 0 },
    { source: "23 == 12", value: 0 },
    { source: "#8010 == #1008", value: 0 },
    { source: "false == true", value: 0 },
    { source: "true == true", value: 1 },
    { source: "false == 123", value: 0 },
    { source: "true == 123", value: 0 },
    { source: "123 == true", value: 0 },
    { source: "2e1 == 1e1", value: 0 },
    { source: "2e1 == 10", value: 0 },
    { source: "20 == 1e1", value: 0 },
    { source: "1e1 == true", value: 0 },
    { source: "true == 1e1", value: 0 },
    { source: '"def" == "abc"', value: 0 },
    { source: '"abc" == "abc"', value: 1 },
    { source: '"abc" == "def"', value: 0 },
    { source: '"" == "def"', value: 0 },
    { source: '"" == ""', value: 1 },
  ];
  eqOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const eqOpFails = [
    { source: 'true == "abc"', pattern: "number" },
    { source: '"abc" == false', pattern: "another" },
    { source: '1 == "abc"', pattern: "number" },
    { source: '1.1 == "abc"', pattern: "number" },
    { source: '"abc" == 1', pattern: "another" },
    { source: '"abc" == 1.1', pattern: "another" },
  ];
  eqOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const ciEqOpSamples = [
    { source: "0 === 3", value: 0 },
    { source: "23 === 12", value: 0 },
    { source: "#8010 === #1008", value: 0 },
    { source: "false === true", value: 0 },
    { source: "true === true", value: 1 },
    { source: "false === 123", value: 0 },
    { source: "true === 123", value: 0 },
    { source: "123 === true", value: 0 },
    { source: "2e1 === 1e1", value: 0 },
    { source: "2e1 === 10", value: 0 },
    { source: "20 === 1e1", value: 0 },
    { source: "1e1 === true", value: 0 },
    { source: "true === 1e1", value: 0 },
    { source: '"def" === "abc"', value: 0 },
    { source: '"abc" === "ABC"', value: 1 },
    { source: '"abc" === "def"', value: 0 },
    { source: '"" === "def"', value: 0 },
    { source: '"" === ""', value: 1 },
  ];
  ciEqOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const ciEqOpFails = [
    { source: 'true === "abc"', pattern: "number" },
    { source: '"abc" === false', pattern: "another" },
    { source: '1 === "abc"', pattern: "number" },
    { source: '1.1 === "abc"', pattern: "number" },
    { source: '"abc" === 1', pattern: "another" },
    { source: '"abc" === 1.1', pattern: "another" },
  ];
  ciEqOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const ciNeqOpSamples = [
    { source: "0 !== 3", value: 1 },
    { source: "23 !== 12", value: 1 },
    { source: "#8010 !== #1008", value: 1 },
    { source: "false !== true", value: 1 },
    { source: "true !== true", value: 0 },
    { source: "false !== 123", value: 1 },
    { source: "true !== 123", value: 1 },
    { source: "123 !== true", value: 1 },
    { source: "2e1 !== 1e1", value: 1 },
    { source: "2e1 !== 10", value: 1 },
    { source: "20 !== 1e1", value: 1 },
    { source: "1e1 !== true", value: 1 },
    { source: "true !== 1e1", value: 1 },
    { source: '"def" !== "abc"', value: 1 },
    { source: '"abc" !== "ABC"', value: 0 },
    { source: '"abc" !== "def"', value: 1 },
    { source: '"" !== "def"', value: 1 },
    { source: '"" !== ""', value: 0 },
  ];
  ciNeqOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const ciNeqOpFails = [
    { source: 'true !== "abc"', pattern: "number" },
    { source: '"abc" !== false', pattern: "another" },
    { source: '1 !== "abc"', pattern: "number" },
    { source: '1.1 !== "abc"', pattern: "number" },
    { source: '"abc" !== 1', pattern: "another" },
    { source: '"abc" !== 1.1', pattern: "another" },
  ];
  ciNeqOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const neqOpSamples = [
    { source: "0 != 3", value: 1 },
    { source: "23 != 12", value: 1 },
    { source: "#8010 != #1008", value: 1 },
    { source: "false != true", value: 1 },
    { source: "true != true", value: 0 },
    { source: "false != 123", value: 1 },
    { source: "true != 123", value: 1 },
    { source: "123 != true", value: 1 },
    { source: "2e1 != 1e1", value: 1 },
    { source: "2e1 != 10", value: 1 },
    { source: "20 != 1e1", value: 1 },
    { source: "1e1 != true", value: 1 },
    { source: "true != 1e1", value: 1 },
    { source: '"def" != "abc"', value: 1 },
    { source: '"abc" != "ABC"', value: 1 },
    { source: '"abc" != "def"', value: 1 },
    { source: '"" != "def"', value: 1 },
    { source: '"" != ""', value: 0 },
  ];
  neqOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const neqOpFails = [
    { source: 'true != "abc"', pattern: "number" },
    { source: '"abc" != false', pattern: "another" },
    { source: '1 != "abc"', pattern: "number" },
    { source: '1.1 != "abc"', pattern: "number" },
    { source: '"abc" != 1', pattern: "another" },
    { source: '"abc" != 1.1', pattern: "another" },
  ];
  neqOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const bandOpSamples = [
    { source: "0 & 3", value: 0 },
    { source: "23 & 12", value: 4 },
    { source: "#8010 & #1008", value: 0 },
    { source: "false & true", value: 0 },
    { source: "true & true", value: 1 },
    { source: "false & 123", value: 0 },
    { source: "true & 123", value: 1 },
    { source: "123 & true", value: 1 },
    { source: "2e1 & 1e1", value: 0 },
    { source: "2e1 & 10", value: 0 },
    { source: "20 & 1e1", value: 0 },
    { source: "1e1 & true", value: 0 },
    { source: "true & 1e1", value: 0 },
    { source: '"abc" & "def"', value: "abc\r\ndef" },
  ];
  bandOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const bandOpFails = [
    { source: 'true & "abc"', pattern: "right" },
    { source: '"abc" & false', pattern: "right" },
    { source: '1 & "abc"', pattern: "right" },
    { source: '1.1 & "abc"', pattern: "left" },
    { source: '"abc" & 1', pattern: "string" },
    { source: '"abc" & 1.1', pattern: "string" },
  ];
  bandOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const borOpSamples = [
    { source: "0 | 3", value: 3 },
    { source: "23 | 12", value: 31 },
    { source: "#8010 | #1008", value: 36888 },
    { source: "false | true", value: 1 },
    { source: "true | true", value: 1 },
    { source: "false | 123", value: 123 },
    { source: "true | 123", value: 123 },
    { source: "123 | true", value: 123 },
    { source: "2e1 | 1e1", value: 30 },
    { source: "2e1 | 10", value: 30 },
    { source: "20 | 1e1", value: 30 },
    { source: "1e1 | true", value: 11 },
    { source: "true | 1e1", value: 11 },
  ];
  borOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const borOpFails = [
    { source: 'true | "abc"', pattern: "right" },
    { source: '"abc" | false', pattern: "left" },
    { source: '1 | "abc"', pattern: "right" },
    { source: '1.1 | "abc"', pattern: "left" },
    { source: '"abc" | 1', pattern: "left" },
    { source: '"abc" | 1.1', pattern: "left" },
  ];
  borOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const bxorOpSamples = [
    { source: "0 ^ 3", value: 3 },
    { source: "23 ^ 12", value: 27 },
    { source: "#8010 ^ #1008", value: 36888 },
    { source: "false ^ true", value: 1 },
    { source: "true ^ true", value: 0 },
    { source: "false ^ 123", value: 123 },
    { source: "true ^ 123", value: 122 },
    { source: "123 ^ true", value: 122 },
    { source: "2e1 ^ 1e1", value: 30 },
    { source: "2e1 ^ 10", value: 30 },
    { source: "20 ^ 1e1", value: 30 },
    { source: "1e1 ^ true", value: 11 },
    { source: "true ^ 1e1", value: 11 },
  ];
  bxorOpSamples.forEach((lit) => {
    it(`Binary: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const bxorOpFails = [
    { source: 'true ^ "abc"', pattern: "right" },
    { source: '"abc" ^ false', pattern: "left" },
    { source: '1 ^ "abc"', pattern: "right" },
    { source: '1.1 ^ "abc"', pattern: "left" },
    { source: '"abc" ^ 1', pattern: "left" },
    { source: '"abc" ^ 1.1', pattern: "left" },
  ];
  bxorOpFails.forEach((lit) => {
    it(`Binary fails: ${lit.source}`, async () => {
      await expressionFails(lit.source, null, [undefined, lit.pattern]);
    });
  });

  const conditionalOpSamples = [
    { source: "23 + 11 > 3 ? 123 : 456", value: 123 },
    { source: "23 + 11 < 3 ? 123 : 456", value: 456 },
  ];
  conditionalOpSamples.forEach((lit) => {
    it(`Conditional: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });

  const currentAddressSamples = [{ source: "$", value: 0x8000 }];
  currentAddressSamples.forEach((lit) => {
    it(`Current address: ${lit.source}`, async () => {
      await testExpression(lit.source, lit.value);
    });
  });
});

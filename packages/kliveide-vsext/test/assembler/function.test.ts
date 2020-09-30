import "mocha";
import { expressionFails, testExpression } from "./test-helpers";

describe("Assembler - functions", () => {
  const functionSamples = [
    { source: "abs(false)", value: 0 },
    { source: "abs(true)", value: 1 },
    { source: "abs(-true)", value: 1 },
    { source: "abs(-123)", value: 123 },
    { source: "abs(0)", value: 0 },
    { source: "abs(123)", value: 123 },
    { source: "abs(-123.25)", value: 123.25 },
    { source: "abs(0.0)", value: 0.0 },
    { source: "abs(123.25)", value: 123.25 },
    { source: "acos(false)", value: 1.5707963267948966 },
    { source: "acos(true)", value: 0.0 },
    { source: "acos(0.0)", value: 1.5707963267948966 },
    { source: "acos(1.0)", value: 0.0 },
    { source: "asin(true)", value: 1.5707963267948966 },
    { source: "asin(false)", value: 0.0 },
    { source: "asin(1.0)", value: 1.5707963267948966 },
    { source: "asin(0.0)", value: 0.0 },
    { source: "atan(true)", value: 0.78539816339744828 },
    { source: "atan(false)", value: 0.0 },
    { source: "atan(1.0)", value: 0.78539816339744828 },
    { source: "atan(0.0)", value: 0.0 },
    { source: "atan2(true, true)", value: 0.78539816339744828 },
    { source: "atan2(false, 1)", value: 0.0 },
    { source: "atan2(1, true)", value: 0.78539816339744828 },
    { source: "atan2(0, 1)", value: 0.0 },
    { source: "atan2(1.0, true)", value: 0.78539816339744828 },
    { source: "atan2(0.0, 1)", value: 0.0 },
    { source: "ceiling(false)", value: 0 },
    { source: "ceiling(true)", value: 1 },
    { source: "ceiling(0)", value: 0 },
    { source: "ceiling(1)", value: 1 },
    { source: "ceiling(0.0)", value: 0 },
    { source: "ceiling(1.0)", value: 1 },
    { source: "ceiling(1.1)", value: 2 },
    { source: "cos(true)", value: 0.54030230586813976 },
    { source: "cos(false)", value: 1.0 },
    { source: "cos(1)", value: 0.54030230586813976 },
    { source: "cos(0)", value: 1.0 },
    { source: "cos(1.0)", value: 0.54030230586813976 },
    { source: "cos(0.0)", value: 1.0 },
    { source: "cosh(true)", value: 1.5430806348152437 },
    { source: "cosh(false)", value: 1.0 },
    { source: "cosh(1)", value: 1.5430806348152437 },
    { source: "cosh(0)", value: 1.0 },
    { source: "cosh(1.0)", value: 1.5430806348152437 },
    { source: "cosh(0.0)", value: 1.0 },
    { source: "exp(true)", value: 2.7182818284590451 },
    { source: "exp(false)", value: 1.0 },
    { source: "exp(1)", value: 2.7182818284590451 },
    { source: "exp(0)", value: 1.0 },
    { source: "exp(1.0)", value: 2.7182818284590451 },
    { source: "exp(0.0)", value: 1.0 },
    { source: "floor(false)", value: 0 },
    { source: "floor(true)", value: 1 },
    { source: "floor(0)", value: 0 },
    { source: "floor(1)", value: 1 },
    { source: "floor(0.0)", value: 0 },
    { source: "floor(1.0)", value: 1 },
    { source: "floor(1.1)", value: 1 },
    { source: "log(true)", value: 0 },
    { source: "log(1)", value: 0 },
    { source: "log(2)", value: 0.69314718055994529 },
    { source: "log(1.0)", value: 0 },
    { source: "log(2.0)", value: 0.69314718055994529 },
    { source: "log(1, 2)", value: 0 },
    { source: "log(100, 10)", value: 2.0 },
    { source: "log(1000, 2)", value: 9.965784284662087 },
    { source: "log10(true)", value: 0 },
    { source: "log10(100)", value: 2 },
    { source: "log10(1000)", value: 3 },
  ];
  functionSamples.forEach((lit) => {
    it(`Invoke: ${lit.source}`, () => {
      testExpression(lit.source, lit.value);
    });
  });

  const functionFailSamples = [
    { source: 'abs("abc")' },
    { source: 'acos("abc")' },
    { source: 'asin("abc")' },
    { source: 'atan("abc")' },
    { source: 'atan2("abc")' },
    { source: 'atan2(1.0)' },
    { source: 'ceiling("abc")' },
    { source: 'cos("abc")' },
    { source: 'cosh("abc")' },
    { source: 'exp("abc")' },
    { source: 'floor("abc")' },
    { source: 'log("abc")' },
    { source: 'log10("abc")' },
  ];
  functionFailSamples.forEach((lit) => {
    it(`Invoke fails: ${lit.source}`, () => {
      expressionFails(lit.source);
    });
  });
});

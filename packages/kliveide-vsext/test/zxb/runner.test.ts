import "mocha";
import * as expect from "expect";

import  { obtainInlineOptions } from "../../src/zxblang/compiler/utils";

describe("ZXB - runner", () => {
  it("extract option from source #1", () => {
    const source = `
    rem @options --sinclair
    print "Hello"
    `;
    const options = obtainInlineOptions(source);
    expect(options).toBe("--sinclair");
  });

  it("extract option from source #2", () => {
    const source = `
    rem @options --sinclair --strict
    print "Hello"
    `;
    const options = obtainInlineOptions(source);
    expect(options).toBe("--sinclair --strict");
  });

  it("extract option from source #3", () => {
    const source = `
    REM   @options --sinclair
    print "Hello"
    `;
    const options = obtainInlineOptions(source);
    expect(options).toBe("--sinclair");
  });

  it("extract option from source #4", () => {
    const source = `
    REM   @Options --sinclair
    print "Hello"
    `;
    const options = obtainInlineOptions(source);
    expect(options).toBe("--sinclair");
  });

  it("extract option from source #5", () => {
    const source = `
    REM ---
    REM   @Options --sinclair
    print "Hello"
    `;
    const options = obtainInlineOptions(source);
    expect(options).toBe("--sinclair");
  });

  it("extract option from source #6", () => {
    const source = `
    REM ---
    REM   @Options --sinclair
    REM   @Options --other
    print "Hello"
    `;
    const options = obtainInlineOptions(source);
    expect(options).toBe("--sinclair");
  });


});

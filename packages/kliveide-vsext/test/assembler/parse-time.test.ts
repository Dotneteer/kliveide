import "mocha";
import * as expect from "expect";

import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "../../src/z80lang/assembler/assembler";

describe("Assembler - parse-time function emit", () => {
  it("textof - ld", () => {
    testCodeEmit(
      `
      .dm textof(ld)
    `,
    0x4C, 0x44
    );
  });

  it("ltextof - ld", () => {
    testCodeEmit(
      `
      .dm ltextof(ld)
    `,
    0x6C, 0x64
    );
  });

  it("textof - bc", () => {
    testCodeEmit(
      `
      .dm textof(bc)
    `,
    0x42, 0x43
    );
  });

  it("ltextof - bc", () => {
    testCodeEmit(
      `
      .dm ltextof(bc)
    `,
    0x62, 0x63
    );
  });

  it("textof - (bc)", () => {
    testCodeEmit(
      `
      .dm textof((bc))
    `,
    0x28, 0x42, 0x43, 0x29
    );
  });

  it("ltextof - (bc)", () => {
    testCodeEmit(
      `
      .dm ltextof((bc))
    `,
    0x28, 0x62, 0x63, 0x29
    );
  });
});

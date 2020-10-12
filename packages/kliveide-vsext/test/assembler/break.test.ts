import "mocha";
import * as expect from "expect";

import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { AssemblerOptions } from "../../src/z80lang/assembler/assembler-in-out";
import { Z80Assembler } from "../../src/z80lang/assembler/assembler";

describe("Assembler - .break", () => {
  it("break - fails in global scope", () => {
    codeRaisesError(
      `
      ld a,b
      .break
    `,
      "Z2059"
    );
  });

  it("break - fails in non-loop scope", () => {
    // TODO: Implement this
  });

  it("break - in loop scope", () => {
    testCodeEmit(
      `
    ld a,b
    .loop 3
        .break
    .endl
    `,
      0x78
    );
  });

  it("break - in repeat scope", () => {
    testCodeEmit(
      `
    ld a,b
    .repeat
        .break
    .until true
    `,
      0x78
    );
  });

  it("break - in while scope", () => {
    testCodeEmit(
      `
    ld a,b
    exit = false
    .while !exit
        .break
        exit = true;
    .endw
    `,
      0x78
    );
  });

  it("break - in for scope", () => {
    testCodeEmit(
      `
    ld a,b
    .for _i = 0 .to 3
        .break
    .next
    `,
      0x78
    );
  });

  it("emit - with loop", () => {
    // TODO: Implement int
  });

  it("emit - with repeat", () => {
    // TODO: Implement int
  });

  it("emit - with while", () => {
    // TODO: Implement int
  });

  it("emit - with for", () => {
    // TODO: Implement int
  });

  it("emit - with nested loop", () => {
    // TODO: Implement int
  });

  it("emit - with nested repeat", () => {
    // TODO: Implement int
  });

  it("emit - with nested while", () => {
    // TODO: Implement int
  });

  it("emit - with nested for", () => {
    // TODO: Implement int
  });
});

import "mocha";

import {
  codeRaisesError,
  codeRaisesErrorWithOptions,
  testCodeEmit,
  testCodeEmitWithOptions,
} from "./test-helpers";
import { AssemblerOptions } from "../../src/main/z80-compiler/assembler-in-out";

describe("Assembler - .local", () => {
  it("local - fails with temporary label", () => {
    codeRaisesError(
      `
    .proc
      .local \`myLocal 
    .endp
    `,
      "Z0504"
    );
  });

  it("local - fails in global scope", () => {
    codeRaisesError(
      `
    .local myLocal 
    `,
      "Z0710"
    );
  });

  it("local - fails with duplication", () => {
    codeRaisesError(
      `
    .proc
      .local myLocal
      .local myLocal
    .endp    `,
      "Z0505"
    );
  });

  it("local - published label", () => {
    testCodeEmit(
      `
    .proc
      local nonpublished
      published: nop
      nonpublished: nop
    .endp
    ld bc,published
    `,
      0x00,
      0x00,
      0x01,
      0x00,
      0x80
    );
  });

  it("local - published label and fixup", () => {
    testCodeEmit(
      `
    ld bc,published
    .proc
      local nonpublished
      published: nop
      nonpublished: nop
    .endp
    `,
      0x01,
      0x03,
      0x80,
      0x00,
      0x00
    );
  });

  it("local - fails with non-published", () => {
    codeRaisesError(
      `
    .proc
      local nonpublished
      published: nop
      nonpublished: nop
    .endp
    ld bc,nonpublished
   `,
      "Z0605"
    );
  });

  it("local - fails with non-published and option", () => {
    const options = new AssemblerOptions();
    options.procExplicitLocalsOnly = true;
    codeRaisesErrorWithOptions(
      `
    .proc
      local nonpublished
      published: nop
      nonpublished: nop
    .endp
    ld bc,nonpublished
   `,
      options,
      "Z0605"
    );
  });

  it("local - explicitly published label", () => {
    const options = new AssemblerOptions();
    options.procExplicitLocalsOnly = true;
    testCodeEmitWithOptions(
      `
    .proc
      published: nop
      nonpublished: nop
    .endp
    ld bc,published
    `,
      options,
      0x00,
      0x00,
      0x01,
      0x00,
      0x80
    );
  });

  it("local - overrides global", () => {
    const options = new AssemblerOptions();
    options.procExplicitLocalsOnly = true;
    testCodeEmitWithOptions(
      `
    read_ok: nop
    .proc
      local ready_ok
      nop
      jp ready_ok
      nop
    ready_ok
      nop
    .endp
    `,
      options,
      0x00,
      0x00,
      0xc3,
      0x06,
      0x80,
      0x00,
      0x00
    );
  });
});

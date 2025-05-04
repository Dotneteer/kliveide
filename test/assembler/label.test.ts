import { describe, it } from "vitest";
import { AssemblerOptions } from "@main/z80-compiler/assembler-in-out";
import {
  codeRaisesError,
  codeRaisesErrorWithOptions,
  testCodeEmit,
  testCodeEmitWithOptions
} from "./test-helpers";

describe("Assembler - labels", async () => {
  it("hanging label", async () => {
    await testCodeEmit(
      `
    .org #6000
    LabelOnly:
        ld a,b
        ld bc,labelonly
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("hanging label - case sensitive", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
    .org #6000
    LabelOnly:
        ld a,b
        ld bc,LabelOnly
    `,
      options,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("hanging label - case sensitive fails", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await codeRaisesErrorWithOptions(
      `
    .org #6000
    LabelOnly:
        ld a,b
        ld bc,labelonly
    `,
      options,
      "Z0605"
    );
  });

  it("dotted name", async () => {
    await testCodeEmit(
      `
    .org #6000
    Label.Only:
        ld a,b
        ld bc,Label.Only
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("dotted name - case sensitive", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await testCodeEmitWithOptions(
      `
    .org #6000
    Label.Only:
        ld a,b
        ld bc,Label.Only
    `,
      options,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("dotted name - case sensitive fails", async () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    await codeRaisesErrorWithOptions(
      `
    .org #6000
    Label.Only:
        ld a,b
        ld bc,label.only
    `,
      options,
      "Z0605"
    );
  });

  it("hanging label - with comment", async () => {
    await testCodeEmit(
      `
    .org #6000
    LabelOnly: ; This is a comment
        ld a,b
        ld bc,labelonly
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("multilabel", async () => {
    await testCodeEmit(
      `
      .org #6000
      LabelOnly1:
      LabelOnly2:
      LabelOnly3:
      LabelOnly4:
      LabelOnly5:
          ld a,b
          ld bc,LabelOnly3
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("hanging label - org", async () => {
    await testCodeEmit(
      `
      LabelOnly:
        .org #6000
        ld a,b
        ld bc,LabelOnly
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("hanging label - equ", async () => {
    await testCodeEmit(
      `
    LabelOnly:
      .org #6000
    LabelOnly2:
      .equ #4567
      ld a,b
      ld bc,LabelOnly2
    `,
      0x78,
      0x01,
      0x67,
      0x45
    );
  });

  it("hanging label - var", async () => {
    await testCodeEmit(
      `
    LabelOnly:
      .org #6000
    LabelOnly2:
      .var #4567
      ld a,b
      ld bc,LabelOnly2
    `,
      0x78,
      0x01,
      0x67,
      0x45
    );
  });

  it("hanging label - orphan", async () => {
    await testCodeEmit(
      `
      .org #6000
      ld a,b
      ld bc,LabelOnly
    LabelOnly:
    `,
      0x78,
      0x01,
      0x04,
      0x60
    );
  });

  it("temp label - back reference", async () => {
    await testCodeEmit(
      `
      Start:
      .org #6000
      ld a,b
    \`t1:
      ld bc,\`t1
    `,
      0x78,
      0x01,
      0x01,
      0x60
    );
  });

  it("temp label - forward reference", async () => {
    await testCodeEmit(
      `
      Start:
      .org #6000
      ld a,b
      ld bc,\`t1
    \`t1:
      ld a,b
    `,
      0x78,
      0x01,
      0x04,
      0x60,
      0x78
    );
  });

  it("Start and end label - forward reference", async () => {
    await testCodeEmit(
      `
      Start:
      .org #6000
      ld a,b
      ld bc,END
    End:
      ld a,b
    `,
      0x78,
      0x01,
      0x04,
      0x60,
      0x78
    );
  });

  it("temp label - different scopes", async () => {
    await testCodeEmit(
      `
      Start:
      .org #6000
      ld a,b
      ld bc,\`t1
    \`t1:
      ld a,b
    Other: 
      ld a,b
      ld bc,\`t1
    \`t1:
      ld a,b
    `,
      0x78,
      0x01,
      0x04,
      0x60,
      0x78,
      0x78,
      0x01,
      0x09,
      0x60,
      0x78
    );
  });

  it("Duplicate label #1", async () => {
    await codeRaisesError(
      `
    Start = $
      nop
    Start:
      nop
    `,
      "Z0501"
    );
  });

  it("Duplicate label #2", async () => {
    await codeRaisesError(
      `
    Start:
      nop
    Start = $
      nop
    `,
      "Z0312"
    );
  });
});

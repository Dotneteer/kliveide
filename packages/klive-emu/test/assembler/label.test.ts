import "mocha";
import {
  codeRaisesErrorWithOptions,
  testCodeEmit,
  testCodeEmitWithOptions,
} from "./test-helpers";
import { AssemblerOptions } from "../../src/main/z80-compiler/assembler-in-out";

describe("Assembler - labels", () => {
  it("hanging label", () => {
    testCodeEmit(
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

  it("hanging label - case sensitive", () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    testCodeEmitWithOptions(
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

  it("hanging label - case sensitive fails", () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    codeRaisesErrorWithOptions(
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

  it("dotted name", () => {
    testCodeEmit(
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

  it("dotted name - case sensitive", () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    testCodeEmitWithOptions(
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

  it("dotted name - case sensitive fails", () => {
    const options = new AssemblerOptions();
    options.useCaseSensitiveSymbols = true;
    codeRaisesErrorWithOptions(
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

  it("hanging label - with comment", () => {
    testCodeEmit(
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

  it("multilabel", () => {
    testCodeEmit(
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

  it("hanging label - org", () => {
    testCodeEmit(
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

  it("hanging label - equ", () => {
    testCodeEmit(
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

  it("hanging label - var", () => {
    testCodeEmit(
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

  it("hanging label - orphan", () => {
    testCodeEmit(
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

  it("temp label - back reference", () => {
    testCodeEmit(
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

  it("temp label - forward reference", () => {
    testCodeEmit(
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

  it("Start and end label - forward reference", () => {
    testCodeEmit(
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

  it("temp label - different scopes", () => {
    testCodeEmit(
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
});

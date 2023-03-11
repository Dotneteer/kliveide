import "mocha";
import { expect } from "expect";

import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "../../electron/z80-compiler/assembler";

describe("Assembler - .module", async () => {
  it("empty module", async () => {
    await testCodeEmit(
      `
    .org #6000
    MyModule: .module
      ld a,b
    .endmodule
    `,
      0x78
    );
  });

  it("fails with no name", async () => {
    await codeRaisesError(
      `
    .org #6000
    .module
      ld a,b
    .endmodule
    `,
      "Z0901"
    );
  });

  it("fails with local name", async () => {
    await codeRaisesError(
      `
    .org #6000
    .module \`MyModule
      ld a,b
    .endmodule
    `,
      "Z0902"
    );
  });

  it("fails with temp label", async () => {
    await codeRaisesError(
      `
    .org #6000
    \`MyModule .module
      ld a,b
    .endmodule
    `,
      "Z0902"
    );
  });

  it("module ID overrides local name", async () => {
    const compiler = new Z80Assembler();
    const source = `
    myModule: .module moduleID
    ld a,b
    .endmodule
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsNestedModule("moduleID")).toBe(true);
  });

  it("fails with duplicated name #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .org #6000
    MyModule .module
        ld a,b
    .endmodule
    ld b,c
    MyModule .module
        ld a,b
    .endmodule
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(2);
    expect(output.errors[0].errorCode === "Z0501").toBe(true);
    expect(output.errors[1].errorCode === "Z0903").toBe(true);
  });

  it("fails with duplicated name #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .org #6000
    MyModule .module
        ld a,b
    .endmodule
    ld b,c
    OtherModule .module MyModule
        ld a,b
    .endmodule
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0903").toBe(true);
  });

  it("fails with duplicated name #3", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .org #6000
    .module MyModule
        ld a,b
    .endmodule
    ld b,c
    OtherModule .module MyModule
        ld a,b
    .endmodule
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0903").toBe(true);
  });

  it("fails with duplicated name #4", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .org #6000
    .module MyModule
        ld a,b
    .endmodule
    ld b,c
    .module MyModule
        ld a,b
    .endmodule
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0903").toBe(true);
  });

  it("fails without module end", async () => {
    await codeRaisesError(
      `
    .org #6000
    .module
    ld a,b
    `,
      "Z0701"
    );
  });

  it("fails with unexpected module end", async () => {
    await codeRaisesError(
      `
    .org #6000
    .endmodule
    `,
      "Z0704"
    );
  });

  it("emit with label", async () => {
    await testCodeEmit(
      `
    .org #6000
    LabelOnly: .module
      ld a,b
      ld bc,LabelOnly
     .endmodule
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("emit with hanging label", async () => {
    await testCodeEmit(
      `
    .org #6000
    LabelOnly:
      .module
      ld a,b
      ld bc,LabelOnly
     .endmodule
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("emit with multiple label", async () => {
    await testCodeEmit(
      `
    .org #6000
    MyModule:
      .module
    LabelOnly1:
    LabelOnly2:
    LabelOnly3:
    LabelOnly4:
    LabelOnly5:
      ld a,b
      ld bc,LabelOnly3
      .endmodule
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("org with hanging label", async () => {
    await testCodeEmit(
      `
    MyModule: .module
    LabelOnly:
      .org #6000
      ld a,b
      ld bc,LabelOnly
      .endmodule
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("equ with hanging label", async () => {
    await testCodeEmit(
      `
    MyModule: .module
    LabelOnly:
      .org #6000
    LabelOnly2:
      .equ #4567
      ld a,b
      ld bc,LabelOnly2
    .endmodule
    `,
      0x78,
      0x01,
      0x67,
      0x45
    );
  });

  it("var with hanging label", async () => {
    await testCodeEmit(
      `
    MyModule: .module
    LabelOnly:
      .org #6000
    LabelOnly2:
      .var #4567
      ld a,b
      ld bc,LabelOnly2
    .endmodule
    `,
      0x78,
      0x01,
      0x67,
      0x45
    );
  });

  it("orphan hanging label", async () => {
    await testCodeEmit(
      `
    .module MyModule
      .org #6000
      ld a,b
      ld bc,LabelOnly
    LabelOnly:
    .endmodule
    `,
      0x78,
      0x01,
      0x04,
      0x60
    );
  });

  it("temp label - backward reference", async () => {
    await testCodeEmit(
      `
    Start:
      .org #6000
      .module MyModule
      ld a,b
    \`t1:
      ld bc,\`t1
    .endmodule
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
      .module MyModule
      .org #6000
      ld a,b
      ld bc,\`t1
    \`t1:
      ld a,b
      .endmodule
    `,
      0x78,
      0x01,
      0x04,
      0x60,
      0x78
    );
  });

  it("start and end label - forward reference", async () => {
    await testCodeEmit(
      `
    Start:
      .module MyModule
      .org #6000
      ld a,b
      ld bc,End
    End:
      ld a,b
    .endmodule
    `,
      0x78,
      0x01,
      0x04,
      0x60,
      0x78
    );
  });

  it("temp labels - different scopes", async () => {
    await testCodeEmit(
      `
    Start:
      .module MyModule
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
      .endmodule
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

  it("module temp labels are independent", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      .module MyModule
      ld a,b
      ld bc,\`t1
    \`t1:
      ld a,b
      .endmodule

    .module MyModule2
      ld a,b
      ld bc,\`t1
    \`t1:
      ld a,b
    .endmodule
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

  it("module labels are independent", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      .module MyModule
      ld a,b
      ld bc,t1
    t1:
      ld a,b
    .endmodule

    .module MyModule2
      ld a,b
      ld bc,t1
    t1:
      ld a,b
    .endmodule
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

  it("internal labels need scope", async () => {
    await codeRaisesError(
      `
    .org #6000
    Start:
      .module MyModule
      ld a,b
      ld bc,t1
    t1:
      ld a,b
    .endmodule
    ld hl,t1
    `,
      "Z0605"
    );
  });

  it("Nested modules work", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      .module MyModule
        ld a,b
        ld bc,t1
      t1:
        ld a,b
      .module Nested
    t1:
      ld a,b
      ld bc,t1
      .endmodule
      ld hl,t1
    .endmodule
    `,
      0x78,
      0x01,
      0x04,
      0x60,
      0x78,
      0x78,
      0x01,
      0x05,
      0x60,
      0x21,
      0x04,
      0x60
    );
  });

  it("Module sees symbols outside #1", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
        nop
        ld bc,Start
      .endmodule
    `,
      0x78,
      0x00,
      0x01,
      0x00,
      0x60
    );
  });

  it("Module sees symbols outside #2", async () => {
    await testCodeEmit(
      `
    .org #6000
    Outside1:
      ld a,b
      .module MyModule
        nop
        .module MyModule2
          ld bc,Outside1
          nop
        .endmodule
      ld hl,OutSide1
    .endmodule
    `,
      0x78,
      0x00,
      0x01,
      0x00,
      0x60,
      0x00,
      0x21,
      0x00,
      0x60
    );
  });

  it("Module sees symbols outside #3", async () => {
    await testCodeEmit(
      `
    .org #6000
    Outside1:
      ld a,b
      .module MyModule
        nop
    Outside2:
      nop
        .module MyModule2
          ld bc,Outside1
          nop
        .endmodule
      ld hl,OutSide2
    .endmodule
    `,
      0x78,
      0x00,
      0x00,
      0x01,
      0x00,
      0x60,
      0x00,
      0x21,
      0x02,
      0x60
    );
  });

  it("Module sees symbols outside #4", async () => {
    await testCodeEmit(
      `
    .org #6000
    Outside:
      ld a,b
      .module MyModule
        nop
    Outside:
      nop
        .module MyModule2
          ld bc,Outside
          nop
        .endmodule
      ld hl,OutSide
    .endmodule
    `,
      0x78,
      0x00,
      0x00,
      0x01,
      0x02,
      0x60,
      0x00,
      0x21,
      0x02,
      0x60
    );
  });

  it("Module sees symbols outside #5", async () => {
    await testCodeEmit(
      `
    .org #6000
    Outside:
      ld a,b
      .module MyModule
        nop
    Outside:
      nop
        .module MyModule2
          ld bc,Outside
          nop
        .endmodule
      ld hl,OutSide
    .endmodule
    ld bc,Outside
    `,
      0x78,
      0x00,
      0x00,
      0x01,
      0x02,
      0x60,
      0x00,
      0x21,
      0x02,
      0x60,
      0x01,
      0x00,
      0x60
    );
  });

  it("Global symbol resolution works", async () => {
    await testCodeEmit(
      `
    .org #6000
    MyStart:
      ld a,b
      ld bc,::MyStart
    `,
      0x78,
      0x01,
      0x00,
      0x60
    );
  });

  it("Global symbol resolution within module", async () => {
    await testCodeEmit(
      `
    .org #6000
    MyStart:
      ld a,b
      .module MyModule
    MyStart:
      ld a,b
      ld bc,MyStart
      ld bc,::MyStart
    .endmodule
    `,
      0x78,
      0x78,
      0x01,
      0x01,
      0x60,
      0x01,
      0x00,
      0x60
    );
  });

  it("Global symbol resolution within module - fixup", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
        ld a,b
        ld bc,MyId
    MyId:
        ld bc,::MyId
      .endmodule
    MyId:
      nop
    `,
      0x78,
      0x78,
      0x01,
      0x05,
      0x60,
      0x01,
      0x08,
      0x60,
      0x00
    );
  });

  it("Module resolution - within module #1", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
    MyId:
      nop
      .module MyModule
    MyId:
      ld a,b
      ld bc,MyId
      ld bc,::MyId
      .endmodule
    ld hl,MyModule.MyId
    `,
      0x78,
      0x00,
      0x78,
      0x01,
      0x02,
      0x60,
      0x01,
      0x01,
      0x60,
      0x21,
      0x02,
      0x60
    );
  });

  it("Module resolution - within module #2", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
    MyId:
      nop
      .module MyModule
    MyId:
      ld a,b
      ld bc,MyId
      ld bc,::MyId
      .endmodule
    ld hl,::MyModule.MyId
    `,
      0x78,
      0x00,
      0x78,
      0x01,
      0x02,
      0x60,
      0x01,
      0x01,
      0x60,
      0x21,
      0x02,
      0x60
    );
  });

  it("Module resolution - within module, fixup #1", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
        ld a,b
        ld bc,MyId
    MyId:
        ld bc,::MyId
      .endmodule
    MyId:
      ld hl,MyModule.MyId
    `,
      0x78,
      0x78,
      0x01,
      0x05,
      0x60,
      0x01,
      0x08,
      0x60,
      0x21,
      0x05,
      0x60
    );
  });

  it("Module resolution - within module, fixup #2", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
        ld a,b
        ld bc,MyId
    MyId:
        ld bc,::MyId
      .endmodule
    MyId:
      ld hl,::MyModule.MyId
    `,
      0x78,
      0x78,
      0x01,
      0x05,
      0x60,
      0x01,
      0x08,
      0x60,
      0x21,
      0x05,
      0x60
    );
  });

  it("Module resolution - within nested module #1", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
    MyId:
      nop
      .module MyModule
    MyId:
      ld a,b
      ld bc,MyId
        .module NestedModule
        Inner:    ld bc,::MyId
        .endmodule
      ld hl,NestedModule.Inner
      .endmodule
    ld hl,MyModule.MyId
    `,
      0x78,
      0x00,
      0x78,
      0x01,
      0x02,
      0x60,
      0x01,
      0x01,
      0x60,
      0x21,
      0x06,
      0x60,
      0x21,
      0x02,
      0x60
    );
  });

  it("Module resolution - within nested module #2", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
    MyId:
      nop
      .module MyModule
    MyId:
      ld a,b
      ld bc,MyId
        .module NestedModule
      Inner:    ld bc,::MyId
        .endmodule
        ld hl,::MyModule.NestedModule.Inner
      .endmodule
    ld hl,::MyModule.MyId
    `,
      0x78,
      0x00,
      0x78,
      0x01,
      0x02,
      0x60,
      0x01,
      0x01,
      0x60,
      0x21,
      0x06,
      0x60,
      0x21,
      0x02,
      0x60
    );
  });

  it("Module resolution - within nested module, fixup #1", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,NestedModule.Inner
        .module NestedModule
        Inner: ld bc,MyId
          MyId: nop   
        .endmodule
    MyId:
      ld bc,::MyId
    .endmodule
    MyId:
      ld hl,MyModule.MyId
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x0b,
      0x60,
      0x21,
      0x08,
      0x60
    );
  });

  it("Module resolution - within nested module, fixup #2", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,::MyModule.NestedModule.Inner
        .module NestedModule
        Inner: ld bc,MyId
          MyId: nop   
        .endmodule
    MyId:
      ld bc,::MyModule.MyId
    .endmodule
    MyId:
      ld hl,MyModule.MyId
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x08,
      0x60,
      0x21,
      0x08,
      0x60
    );
  });

  it("Module resolution - within nested module, fixup #3", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
        ld hl,::MyModule.NestedModule.Inner
        .module NestedModule
        Inner: ld bc,MyId
        MyId: nop   
        .endmodule
    MyId:
      ld bc,NestedModule.MyId
    .endmodule
    MyId:
      ld hl,MyModule.MyId
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x07,
      0x60,
      0x21,
      0x08,
      0x60
    );
  });

  it("Module resolution - within nested module, fixup #4", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,::MyModule.NestedModule.Inner
        .module NestedModule
        Inner: ld bc,MyId
        MyId: nop   
        .endmodule
    MyId:
      ld bc,::MyModule.NestedModule.MyId
    .endmodule
    MyId:
      ld hl,MyModule.MyId
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x07,
      0x60,
      0x21,
      0x08,
      0x60
    );
  });

  it("Module resolution - within nested module, fixup #5", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,NestedModule.Inner
        NestedModule: .module
        Inner: ld bc,MyId
        MyId: nop   
        .endmodule
    MyId:
      ld bc,::MyId
      .endmodule
    MyId:
      ld hl,MyModule.MyId
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x0b,
      0x60,
      0x21,
      0x08,
      0x60
    );
  });

  it("Module resolution - within nested module, fixup #6", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,::MyModule.NestedModule.Inner
        NestedModule: .module
        Inner: ld bc,MyId
        MyId: nop   
        .endmodule
    MyId:
      ld bc,::MyModule.MyId
    .endmodule
    MyId:
      ld hl,MyModule.MyId
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x08,
      0x60,
      0x21,
      0x08,
      0x60
    );
  });

  it("Module resolution - within nested module, fixup #7", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,::MyModule.NestedModule.Inner
        NestedModule: .module
        Inner: ld bc,MyId
        MyId: nop   
        .endmodule
    MyId:
      ld bc,NestedModule.MyId
    .endmodule
    MyId:
      ld hl,MyModule.MyId
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x07,
      0x60,
      0x21,
      0x08,
      0x60
    );
  });

  it("Module resolution - within nested module, fixup #8", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,::MyModule.NestedModule.Inner
        NestedModule: .scope
        Inner: ld bc,MyId
        MyId: nop   
        .endmodule
    MyId:
      ld bc,::MyModule.NestedModule.MyId
      .endmodule
    MyId:
      ld hl,MyModule.MyId
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x07,
      0x60,
      0x21,
      0x08,
      0x60
    );
  });

  it("Module - local resolution", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
    MyId:
      nop
      .module MyModule
    @MyId:
      ld a,b
      ld bc,@MyId
      ld bc,::MyId
    .endmodule
    `,
      0x78,
      0x00,
      0x78,
      0x01,
      0x02,
      0x60,
      0x01,
      0x01,
      0x60
    );
  });

  it("Module - local resolution, fixup", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld a,b
      ld bc,@MyId
    @MyId:
      ld bc,::MyId
    .endmodule
    MyId:
      nop
    `,
      0x78,
      0x78,
      0x01,
      0x05,
      0x60,
      0x01,
      0x08,
      0x60,
      0x00
    );
  });

  it("Module - nestedlocal resolution #1", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
    MyId:
      nop
      .module MyModule
    @MyId:
      ld a,b
      ld bc,@MyId
      .module NestedModule
      Inner:    ld bc,::MyId
      .endmodule
      ld hl,NestedModule.Inner
    .endmodule
    `,
      0x78,
      0x00,
      0x78,
      0x01,
      0x02,
      0x60,
      0x01,
      0x01,
      0x60,
      0x21,
      0x06,
      0x60
    );
  });

  it("Module - nestedlocal resolution #2", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,NestedModule.Inner
        .module NestedModule
        Inner: ld bc,@MyId
        @MyId: nop   
        .endmodule
    @MyId:
      ld bc,::MyId
    .endmodule
    MyId:
      nop
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x0b,
      0x60,
      0x00
    );
  });

  it("Module - nestedlocal resolution #3", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,NestedModule.Inner
        .module NestedModule
        Inner: ld bc,@MyId
        @MyId: nop   
        .endmodule
    @MyId:
      ld bc,::MyId
    .endmodule
    MyId:
      nop
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x01,
      0x0b,
      0x60,
      0x00
    );
  });

  it("Module - nestedlocal resolution #4", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      ld a,b
      .module MyModule
      ld hl,::MyModule.NestedModule.Inner
        .module NestedModule
        Inner: ld bc,@MyId
        @MyId: nop   
        .endmodule
    @MyId:
      .endmodule
    @MyId:
      nop
    `,
      0x78,
      0x21,
      0x04,
      0x60,
      0x01,
      0x07,
      0x60,
      0x00,
      0x00
    );
  });

  it("fails with unknown module name #1", async () => {
    await codeRaisesError(
      `
    .org #6000
    Start:
      .module MyModule
        ld a,b
        ld bc,t1
    t1:
        ld a,b
      .endmodule
    ld hl,OtherModule.t1
    `,
      "Z0605"
    );
  });

  it("fails with unknown module name #2", async () => {
    await codeRaisesError(
      `
    .org #6000
    Start:
      .module MyModule
        ld a,b
        ld bc,t1
    t1:
        ld a,b
      .endmodule
      ld hl,::OtherModule.t1
    `,
      "Z0605"
    );
  });

  it("Module local is resolved at the first level", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      .module @MyModule
        ld a,b
        ld bc,t1
    t1:
        ld a,b
      .endmodule
      ld hl,@MyModule.t1
    `,
      0x78,
      0x01,
      0x04,
      0x60,
      0x78,
      0x21,
      0x04,
      0x60
    );
  });

  it("local module name is hidden #1", async () => {
    await codeRaisesError(
      `
    .org #6000
    Start:
      .module MyModule
        ld a,b
        .module @Nested
        Inner: nop
        .endmodule
        ld bc,t1
    t1:
      ld a,b
      .endmodule
    ld hl,MyModule.@Nested.Inner
    `,
      "Z0605"
    );
  });

  it("local module name is hidden #2", async () => {
    await codeRaisesError(
      `
    .org #6000
    Start:
      .module @MyModule
        ld a,b
        .module @Nested
        Inner: nop
        .endmodule
        ld bc,t1
    t1:
        ld a,b
      .endmodule
      ld hl,@MyModule.@Nested.Inner
    `,
      "Z0605"
    );
  });

  it("local module name is hidden #3", async () => {
    await codeRaisesError(
      `
    .org #6000
    Start:
      .module MyModule
        ld a,b
        .module Nested
        @Inner: nop
        .endmodule
        ld bc,t1
    t1:
        ld a,b
      .endmodule
      ld hl,MyModule.Nested.@Inner
    `,
      "Z0605"
    );
  });

  it("non-local module is visible", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .org #6000
    Start:
      .module MyModule
        ld a,b
        .module Nested
        Inner: nop
        .endmodule
        ld bc,t1
    t1:
        ld a,b
      .endmodule
    ld hl,MyModule.Nested.Inner
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
  });

  it("Module start can be addressed with label", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      .module MyModule
        ld a,b
        MyNested: .module Nested
        Inner: nop
        .endmodule
        ld bc,t1
    t1:
        ld a,b
      .endmodule
      ld hl,Start
    `,
      0x78,
      0x00,
      0x01,
      0x05,
      0x60,
      0x78,
      0x21,
      0x00,
      0x60
    );
  });

  it("Nested module start can be addressed with label #1", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      .module MyModule
        ld a,b
        MyNested: .module Nested
        Inner: nop
        .endmodule
        ld bc,t1
    t1:
        ld a,b
        .endmodule
      ld hl,MyModule.MyNested
    `,
      0x78,
      0x00,
      0x01,
      0x05,
      0x60,
      0x78,
      0x21,
      0x01,
      0x60
    );
  });

  it("Nested module start can be addressed with label #2", async () => {
    await testCodeEmit(
      `
    .org #6000
    Start:
      .module MyModule
        ld a,b
        MyNested: .module
        Inner: nop
        .endmodule
        ld bc,t1
    t1:
        ld a,b
      .endmodule
      ld hl,MyModule.MyNested
    `,
      0x78,
      0x00,
      0x01,
      0x05,
      0x60,
      0x78,
      0x21,
      0x01,
      0x60
    );
  });
});

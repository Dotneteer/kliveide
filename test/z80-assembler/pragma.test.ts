import { describe, it, expect } from "vitest";
import { testCodeEmit, codeRaisesError, testFlexibleCodeEmit } from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

describe("Assembler - pragmas", async () => {
  it("org - existing segment", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("org - sets label", async () => {
    const compiler = new Z80Assembler();
    const source = `
      MySymbol .org #6789
      ld a,b
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.getSymbol("MySymbol").value.value).toBe(0x6789);
  });

  it("org - fails with duplicated labed", async () => {
    await codeRaisesError(
      `
      MySymbol .equ #100
      MySymbol .org #6789
        ld a,b
      `,
      "Z0501"
    );
  });

  it("equ - immediate evaluation", async () => {
    const compiler = new Z80Assembler();
    const source = `
      MySymbol .equ 200
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.getSymbol("MySymbol").value.value).toBe(200);
  });

  it("equ - label with dot", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .__LABEL__.ZXBASIC_USER_DATA_LEN EQU 200
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.getSymbol("__LABEL__.ZXBASIC_USER_DATA_LEN").value.value).toBe(200);
  });

  it("equ - fails with duplicated labed", async () => {
    await codeRaisesError(
      `
      MySymbol .equ #100
      MySymbol .equ #6789
        ld a,b
      `,
      "Z0501"
    );
  });

  it("var - fails with equ label", async () => {
    await codeRaisesError(
      `
      MySymbol .equ #100
      MySymbol .var #6789
        ld a,b
      `,
      "Z0312"
    );
  });

  it("var - fails with duplicated label", async () => {
    await codeRaisesError(
      `
      MySymbol: nop
      MySymbol .var #6789
        ld a,b
      `,
      "Z0312"
    );
  });

  it("bank - existing segment #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 1
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xc000);
    expect(output.segments[1].bank).toBe(1);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - existing segment #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 7
      .org #E000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xe000);
    expect(output.segments[1].bank).toBe(7);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - existing segment #3", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 1
      .defb 0x01, 0x02, 0x03
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xc000);
    expect(output.segments[1].bank).toBe(1);
    expect(output.segments[1].displacement).toBeUndefined();
    expect(output.segments[1].emittedCode.length).toBe(3);
    expect(output.segments[1].emittedCode[0]).toBe(0x01);
    expect(output.segments[1].emittedCode[1]).toBe(0x02);
    expect(output.segments[1].emittedCode[2]).toBe(0x03);
  });

  it("bank - new segment #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 3
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xc000);
    expect(output.segments[0].bank).toBe(3);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - new segment #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4
      .org $e000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xe000);
    expect(output.segments[0].bank).toBe(4);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - multiple pragma", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 1
      nop
      .bank 3
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0xc000);
    expect(output.segments[0].bank).toBe(1);
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xc000);
    expect(output.segments[1].bank).toBe(3);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - with invalid model #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .bank 4
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0308").toBe(true);
  });

  it("bank - with invalid model #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum48
      .bank 4
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0308").toBe(true);
  });

  it("bank - with label", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      myLabel .bank 4
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0305").toBe(true);
  });

  it("bank - invalid value #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank -1
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0306").toBe(true);
  });

  it("bank - invalid value #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 8
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0306").toBe(true);
  });

  it("bank - reuse bank", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 1
      .bank 3
      .bank 1
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0309").toBe(true);
  });

  it("bank - maximum length works", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4
      .defs 0x4000, 0x34
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
  });

  it("bank - maximum length overflows", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4
      .org #8000
      .defs 0x4000, 0x34
      .defb 0x00
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0411").toBe(true);
  });

  it("bank - offseted bank with existing segment #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 1, #400
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xc400);
    expect(output.segments[1].bank).toBe(1);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - offseted bank with existing segment #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 1, #400
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xc400);
    expect(output.segments[1].bank).toBe(1);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - offseted bank with existing segment #3", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 7, #400
      .org #E000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xe000);
    expect(output.segments[1].bank).toBe(7);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - offseted bank with new segment #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 3, #400
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xc400);
    expect(output.segments[0].bank).toBe(3);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - offseted bank with new segment #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 1, #400
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xc400);
    expect(output.segments[0].bank).toBe(1);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - offseted bank with new segment #3", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, #400
      .org #e000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xe000);
    expect(output.segments[0].bank).toBe(4);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - multiple offseted pragmas", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 1, #2000
      nop
      .bank 3, #1000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0xe000);
    expect(output.segments[0].bank).toBe(1);
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xd000);
    expect(output.segments[1].bank).toBe(3);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - offseted with invalid model #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .bank 4, #1000
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0308").toBe(true);
  });

  it("bank - offseted with invalid model #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum48
      .bank 4, #1000
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0308").toBe(true);
  });

  it("bank - offseted with invalid value #1", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, #5678
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0307").toBe(true);
  });

  it("bank - offseted with invalid value #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, -#1000
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0307").toBe(true);
  });

  it("bank - offseted with invalid value #3", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, #4000
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0307").toBe(true);
  });

  it("bank - maximum offseted bank length", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, #1000
      .defs 0x3000, 0x34
    `;

    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
  });

  it("bank - maximum offseted bank length overflows", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, #1000
      .org #8000
      .defs 0x3000, 0x34
      .defb 0x00
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0411").toBe(true);
  });

  // --- ZX Spectrum Next bank tests (0-111 banks, multiple segments per bank)
  
  it("bank - Next model basic", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 5
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xc000);
    expect(output.segments[0].bank).toBe(5);
  });

  it("bank - Next model high bank number", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 111
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xc000);
    expect(output.segments[0].bank).toBe(111);
  });

  it("bank - Next model bank 50", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 50
      ld a,1
      ret
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].bank).toBe(50);
    expect(output.segments[0].emittedCode.length).toBe(3);
  });

  it("bank - Next model invalid bank number too high", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 112
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0306").toBe(true);
  });

  it("bank - Next model multiple segments same bank", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 5
      .org #C000
      ld a,1
      ret
      
      .bank 5
      .org #D000
      ld b,2
      ret
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].bank).toBe(5);
    expect(output.segments[0].startAddress).toBe(0xc000);
    expect(output.segments[1].bank).toBe(5);
    expect(output.segments[1].startAddress).toBe(0xd000);
  });

  it("bank - Next model reuse bank allowed", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 5
      nop
      .bank 10
      nop
      .bank 5
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(3);
    expect(output.segments[0].bank).toBe(5);
    expect(output.segments[1].bank).toBe(10);
    expect(output.segments[2].bank).toBe(5);
  });

  it("bank - Next model multiple banks", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 5
      ld a,1
      
      .bank 2
      ld b,2
      
      .bank 10
      ld c,3
      
      .bank 111
      ld d,4
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(4);
    expect(output.segments[0].bank).toBe(5);
    expect(output.segments[1].bank).toBe(2);
    expect(output.segments[2].bank).toBe(10);
    expect(output.segments[3].bank).toBe(111);
  });

  it("bank - Next model with offset", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 20, #1000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].bank).toBe(20);
    expect(output.segments[0].startAddress).toBe(0xd000);
    expect(output.segments[0].bankOffset).toBe(0x1000);
  });

  it("bank - Next model multiple segments same bank with org", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 5
      .org #C000
      Start:
        ld a,1
        ret
      
      .bank 5
      .org #E000
      Data:
        .defb 1,2,3,4
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].bank).toBe(5);
    expect(output.segments[0].startAddress).toBe(0xc000);
    expect(output.segments[1].bank).toBe(5);
    expect(output.segments[1].startAddress).toBe(0xe000);
  });

  it("bank - Spectrum128 still rejects reuse", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 1
      nop
      .bank 1
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0309").toBe(true);
  });

  it("bank - Spectrum128 rejects high bank numbers", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 8
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0306").toBe(true);
  });

  it("bank - noexport flag with Next model", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 5 noexport
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].bank).toBe(5);
    expect(output.segments[0].nexExport).toBe(false);
  });

  it("bank - noexport flag with Spectrum128 model", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 5 noexport
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0331").toBe(true);
  });

  it("bank - noexport flag with Spectrum48 model", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum48
      .bank 5 noexport
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0308").toBe(true);
  });

  it("bank - noexport flag with offset", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 10, #800 noexport
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].bank).toBe(10);
    expect(output.segments[0].bankOffset).toBe(0x800);
    expect(output.segments[0].nexExport).toBe(false);
  });

  it("bank - multiple banks with selective noexport", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 5
      ld a,1
      ret
      
      .bank 10 noexport
      ld b,2
      ret
      
      .bank 15
      ld c,3
      ret
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(3);
    expect(output.segments[0].bank).toBe(5);
    expect(output.segments[0].nexExport).toBe(true);
    expect(output.segments[1].bank).toBe(10);
    expect(output.segments[1].nexExport).toBe(false);
    expect(output.segments[2].bank).toBe(15);
    expect(output.segments[2].nexExport).toBe(true);
  });

  it("bank - default nexExport is true for Next model without flag", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 5
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].bank).toBe(5);
    expect(output.segments[0].nexExport).toBe(true);
  });

  it("bank - case-insensitive noexport keyword", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .bank 5 NOEXPORT
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].nexExport).toBe(false);
  });

  it("xorg - negative value", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg -100
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].xorgValue).toBe(0x10000 - 100);
  });

  it("xorg - positive value", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg #1000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].xorgValue).toBe(0x1000);
  });

  it("xorg - zero value", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg 0
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].xorgValue).toBe(0x0000);
  });

  it("xorg - multiple in the same segment", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg 0
      nop
      .xorg #1000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0314").toBe(true);
  });

  it("xorg - multiple in separate segments", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg 0
      nop
      .org #6600
      .xorg #1000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
  });

  it("ent - single pragma", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .ent #6400
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.entryAddress).toBe(0x6400);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("ent - late binding", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .org #6789
    .ent MyStart
      nop
    MyStart: ld a,b
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.entryAddress).toBe(0x678a);
  });

  it("ent - multiple pragma", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .ent #6400
      nop
      .ent #1234
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.entryAddress).toBe(0x1234);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("ent - works with current address", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .ent $
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.entryAddress).toBe(0x6401);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("xent - single pragma", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .xent #6400
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.exportEntryAddress).toBe(0x6400);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("xent - late binding", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .org #6789
    .xent MyStart
      nop
    MyStart: ld a,b
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.exportEntryAddress).toBe(0x678a);
  });

  it("xent - multiple pragma", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .xent #6400
      nop
      .xent #1234
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.exportEntryAddress).toBe(0x1234);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("xent - works with current address", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .xent $
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.exportEntryAddress).toBe(0x6401);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("disp - negative value", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .disp -100
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].displacement).toBe(0x10000 - 100);
  });

  it("disp - positive value", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .disp #1000
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].displacement).toBe(0x1000);
  });

  it("disp - zero value", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .disp 0
      nop
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].displacement).toBe(0x0000);
  });

  it("disp - emits displaced code #1", async () => {
    await await testCodeEmit(
      `
      .org #8000
      .disp #20
      nop
      call Test
      halt
      Test: ret
    `,
      0x00,
      0xcd,
      0x25,
      0x80,
      0x76,
      0xc9
    );
  });

  it("disp - emits displaced code #2", async () => {
    await await testCodeEmit(
      `
      .org #8000
      .disp -#20
      nop
      call Test
      halt
      Test: ret
    `,
      0x00,
      0xcd,
      0xe5,
      0x7f,
      0x76,
      0xc9
    );
  });

  it("disp - handles address shift #1", async () => {
    await await testCodeEmit(
      `
      .org #8000
      nop
      .disp #100
      This: ld bc, this
      call Test
      halt
      Test: ret
    `,
      0x00,
      0x01,
      0x01,
      0x81,
      0xcd,
      0x08,
      0x81,
      0x76,
      0xc9
    );
  });

  it("disp - handles address shift #2", async () => {
    await await testCodeEmit(
      `
      .org #8000
      nop
      This: ld bc, this
      .disp #100
      call Test
      halt
      Test: ret
    `,
      0x00,
      0x01,
      0x01,
      0x80,
      0xcd,
      0x08,
      0x81,
      0x76,
      0xc9
    );
  });

  it("disp - handles address shift #3", async () => {
    await await testCodeEmit(
      `
      .org #8000
      nop
      .disp #100
      This: jr Test
      halt
      Test: ret
    `,
      0x00,
      0x18,
      0x01,
      0x76,
      0xc9
    );
  });

  it("disp - handles address shift #4", async () => {
    await codeRaisesError(
      `
      .org #8000
      nop
      This: jr Test
      .disp #100
      halt
      Test: ret
    `,
      "Z0403"
    );
  });

  const varPragmas = [".var", "=", ":="];
  varPragmas.forEach((varPragma) => {
    it(`var - initial definition (${varPragma})`, async () => {
      const compiler = new Z80Assembler();
      const source = `
        MySymbol ${varPragma} 100+100
        nop
      `;

      const output = await compiler.compile(source);

      expect(output.errorCount).toBe(0);
      expect(output.segments.length).toBe(1);
      expect(output.getSymbol("MySymbol").value.value).toBe(200);
    });

    it(`var - re-assignment (${varPragma})`, async () => {
      const compiler = new Z80Assembler();
      const source = `
        MySymbol ${varPragma} 100+100
        nop
        MySymbol ${varPragma} MySymbol*3
      `;

      const output = await compiler.compile(source);

      expect(output.errorCount).toBe(0);
      expect(output.segments.length).toBe(1);
      expect(output.getSymbol("MySymbol").value.value).toBe(600);
    });

    it(`var - no label (${varPragma})`, async () => {
      const compiler = new Z80Assembler();
      const source = `
        ${varPragma} 100+100
      `;

      const output = await compiler.compile(source);

      expect(output.errorCount).toBe(1);
      expect(output.errors[0].errorCode === "Z0311").toBe(true);
    });

    it(`var - local label (${varPragma})`, async () => {
      const compiler = new Z80Assembler();
      const source = `
        \`local ${varPragma} 100+100
      `;

      const output = await compiler.compile(source);

      expect(output.errorCount).toBe(0);
    });
  });

  it("skip - no fill value", async () => {
    const source = `.skip $+#05`;
    await await testCodeEmit(source, 0xff, 0xff, 0xff, 0xff, 0xff);
  });

  it("skip - with fill value", async () => {
    const source = `.skip $+#04, #3a`;
    await await testCodeEmit(source, 0x3a, 0x3a, 0x3a, 0x3a);
  });

  it("skip - negative value", async () => {
    const compiler = new Z80Assembler();
    const source = `.skip $-#04`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0313").toBe(true);
  });

  it("skip - non-immediate value", async () => {
    const compiler = new Z80Assembler();
    const source = `.skip MySymbol+#04`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0605").toBe(true);
  });

  it("skip - non-immediate value and fill", async () => {
    const compiler = new Z80Assembler();
    const source = `.skip MySymbol+#04, #3a`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0605").toBe(true);
  });

  it("defb - immediate evaluation", async () => {
    const source = `.defb #01, #2345, #AE, 122`;
    await await testCodeEmit(source, 0x01, 0x45, 0xae, 122);
  });

  it("defb - fails with string", async () => {
    const compiler = new Z80Assembler();
    const source = `.defb "Hello"`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0601").toBe(true);
  });

  it("defb - flexible mode", async () => {
    const source = `
    .defb "\\x12\\i\\Iabc\\P"
    `;

    testFlexibleCodeEmit(source, 0x12, 0x10, 0x14, 0x61, 0x62, 0x63, 0x60);
  });

  it("defw - immediate evaluation", async () => {
    const source = `.defw #A001, #2345, #AE12, 122`;
    await await testCodeEmit(source, 0x01, 0xa0, 0x45, 0x23, 0x12, 0xae, 122, 0);
  });

  it("defw - fails with string", async () => {
    const compiler = new Z80Assembler();
    const source = `.defw "Hello"`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0601").toBe(true);
  });

  it("defw - with function", async () => {
    const source = `.defw 1000*sin(1.5)`;
    await await testCodeEmit(source, 0xe5, 0x03);
  });

  it("defw - fails with function", async () => {
    const compiler = new Z80Assembler();
    const source = `.DEFW 1000/sinx(1.5)`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0606").toBe(true);
  });

  it("defm - immediate evaluation", async () => {
    const source = `.defm "\\x12\\i\\Iabc\\P"`;
    await await testCodeEmit(source, 0x12, 0x10, 0x14, 0x61, 0x62, 0x63, 0x60);
  });

  it("defm - fails with non-string", async () => {
    const compiler = new Z80Assembler();
    const source = `.defm 1234`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0315").toBe(true);
  });

  it("defm - flexible mode", async () => {
    const source = `
    .defm 123
    `;

    testFlexibleCodeEmit(source, 123);
  });

  it("defn - immediate evaluation", async () => {
    const source = `.defn "\\x12\\i\\Iabc\\P"`;
    await await testCodeEmit(source, 0x12, 0x10, 0x14, 0x61, 0x62, 0x63, 0x60, 0x00);
  });

  it("defn - fails with non-string", async () => {
    const compiler = new Z80Assembler();
    const source = `.defn 1234`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0315").toBe(true);
  });

  it("defn - flexible mode", async () => {
    const source = `
    .defn 123
    `;

    testFlexibleCodeEmit(source, 123, 0);
  });

  it("defc - immediate evaluation", async () => {
    const source = `.defc "\\x12\\i\\Iabc\\P"`;
    await await testCodeEmit(source, 0x12, 0x10, 0x14, 0x61, 0x62, 0x63, 0xe0);
  });

  it("defc - fails with non-string", async () => {
    const compiler = new Z80Assembler();
    const source = `.defc 1234`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0315").toBe(true);
  });

  it("defc - flexible mode", async () => {
    const source = `
    .defc 0x22
    `;

    testFlexibleCodeEmit(source, 0xa2);
  });

  it("defh - immediate evaluation", async () => {
    const source = `.defh "0105C1af27d3"`;
    await await testCodeEmit(source, 0x01, 0x05, 0xc1, 0xaf, 0x27, 0xd3);
  });

  it("defh - empty string", async () => {
    const source = `.defh ""`;
    await await testCodeEmit(source);
  });

  it("defh - fails with non-string", async () => {
    const compiler = new Z80Assembler();
    const source = `.defh 1234`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0316").toBe(true);
  });

  it("defh - fails with odd length", async () => {
    const compiler = new Z80Assembler();
    const source = `.defh "010"`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0317").toBe(true);
  });

  it("defh - fails with non-hexa char", async () => {
    const compiler = new Z80Assembler();
    const source = `.defh "00Qa"`;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z0317").toBe(true);
  });

  it("defs - immediate evaluation #1", async () => {
    const source = `.defs 6`;
    await await testCodeEmit(source, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
  });

  it("defs - immediate evaluation #2", async () => {
    const source = `.defs 6, #2a`;
    await await testCodeEmit(source, 0x2a, 0x2a, 0x2a, 0x2a, 0x2a, 0x2a);
  });

  it("defs - indirect evaluation #1", async () => {
    const source = `
    count .equ 3
    .defs count, #2a
    `;
    await await testCodeEmit(source, 0x2a, 0x2a, 0x2a);
  });

  it("defs - indirect evaluation #2", async () => {
    const source = `
    count .equ 3
    .defs count
    `;
    await await testCodeEmit(source, 0x00, 0x00, 0x00);
  });

  it("defs - indirect evaluation #3", async () => {
    const source = `
    count .equ 3
    value .equ #2a
    .defs count, value
    `;
    await await testCodeEmit(source, 0x2a, 0x2a, 0x2a);
  });

  it("fillb - immediate evaluation #1", async () => {
    const source = `.fillb 6, #2a`;
    await await testCodeEmit(source, 0x2a, 0x2a, 0x2a, 0x2a, 0x2a, 0x2a);
  });

  it("fillb - indirect evaluation #1", async () => {
    const source = `
    count .equ 3
    .fillb count, #2a
    `;
    await await testCodeEmit(source, 0x2a, 0x2a, 0x2a);
  });

  it("fillb - indirect evaluation #2", async () => {
    const source = `
    count .equ 3
    value .equ #2a
    .fillb count, value
    `;
    await await testCodeEmit(source, 0x2a, 0x2a, 0x2a);
  });

  it("fillw - immediate evaluation #1", async () => {
    const source = `.fillw 3,#80A5`;
    await await testCodeEmit(source, 0xa5, 0x80, 0xa5, 0x80, 0xa5, 0x80);
  });

  it("fillw - indirect evaluation #1", async () => {
    const source = `
    count .equ 3
    .fillw count, #80a5
    `;
    await await testCodeEmit(source, 0xa5, 0x80, 0xa5, 0x80, 0xa5, 0x80);
  });

  it("fillw - indirect evaluation #2", async () => {
    const source = `
    count .equ 3
    value .equ #80a5
    .fillw count, value
    `;
    await await testCodeEmit(source, 0xa5, 0x80, 0xa5, 0x80, 0xa5, 0x80);
  });

  it("align - no expression", async () => {
    const compiler = new Z80Assembler();
    const source = `
      halt
      .align
      halt
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);

    const bytes = output.segments[0].emittedCode;
    expect(bytes[0]).toBe(0x76);
    for (let i = 1; i < 0x100; i++) {
      expect(bytes[i]).toBe(0x00);
    }
    expect(bytes[0x100]).toBe(0x76);
  });

  const alignCases = [
    { entry: "halt", align: 0x100, exit: "halt", head: [0x76], tail: [0x76] },
    { entry: "halt", align: 0x02, exit: "halt", head: [0x76], tail: [0x76] },
    { entry: "halt", align: 0x04, exit: "halt", head: [0x76], tail: [0x76] },
    { entry: "", align: 0x08, exit: "halt", head: [], tail: [0x76] },
    { entry: "halt", align: 0x10, exit: "", head: [0x76], tail: [] }
  ];
  alignCases.forEach((alc, index) => {
    it(`align: #${index + 1}`, async () => {
      const compiler = new Z80Assembler();
      const source = `
        ${alc.entry}
        .align ${alc.align}
        ${alc.exit}
      `;
      const output = await compiler.compile(source);

      expect(output.errorCount).toBe(0);
      expect(output.segments.length).toBe(1);

      const bytes = output.segments[0].emittedCode;
      const alignedLength = alc.head.length === 0 ? 0x00 : alc.align;
      expect(bytes.length).toBe(alignedLength + alc.tail.length);
      for (let i = 0; i < alc.head.length; i++) {
        expect(bytes[i]).toBe(alc.head[i]);
      }
      for (let i = alc.head.length; i < alignedLength; i++) {
        expect(bytes[i]).toBe(0x00);
      }
      for (let i = 0; i < alc.tail.length; i++) {
        expect(bytes[alignedLength + i]).toBe(alc.tail[i]);
      }
    });
  });

  const traceCases = [
    { source: ".trace #100", expected: "256" },
    { source: ".tracehex #100", expected: "0100" },
    { source: '.trace "Hello", #100, #200', expected: "Hello256512" },
    { source: ".trace 3.14/2", expected: "1.57" },
    { source: ".tracehex #1000*#1000", expected: "01000000" },
    { source: '.tracehex "Hello"', expected: "48656c6c6f" }
  ];
  traceCases.forEach((tc) => {
    it(`trace: ${tc.source}`, async () => {
      const compiler = new Z80Assembler();
      let messageReceived = "";
      compiler.setTraceHandler((msg: string) => (messageReceived += msg));
      const output = await compiler.compile(tc.source);

      expect(output.errorCount).toBe(0);
      expect(output.segments.length).toBe(1);
      expect(messageReceived).toBe(tc.expected);
    });
  });

  const errorCases = [
    { source: ".error true", expected: "ERROR: true" },
    {
      source: '.error "This is an error"',
      expected: "ERROR: This is an error"
    },
    { source: ".error 123", expected: "ERROR: 123" },
    { source: ".error 123.5+1", expected: "ERROR: 124.5" }
  ];
  errorCases.forEach((ec) => {
    it(`error: ${ec.source}`, async () => {
      const compiler = new Z80Assembler();
      const output = await compiler.compile(ec.source);
      expect(output.errorCount).toBe(1);
      expect(output.errors[0].errorCode === "Z2000").toBe(true);
      expect(output.errors[0].message).toBe(ec.expected);
    });
  });

  it("injectopt #1 - cursork (deprecated)", async () => {
    const compiler = new Z80Assembler();
    const source = ".injectopt cursork";

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.injectOptions["cursork"]).toBe(true);
  });

  it("injectopt #2 - cursorl", async () => {
    const compiler = new Z80Assembler();
    const source = ".injectopt cursorl";

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.injectOptions["cursorl"]).toBe(true);
  });

  it("injectopt #3 - cursorl case insensitivity", async () => {
    const compiler = new Z80Assembler();
    const source = ".injectopt CURSORL";

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.injectOptions["cursorl"]).toBe(true);
  });

  it("injectopt #4 - multiple cursorl options", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .injectopt cursorl
      nop
      .injectopt cursorl
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.injectOptions["cursorl"]).toBe(true);
  });

  it("injectopt #5 - cursorl with subroutine", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .injectopt cursorl
      .injectopt subroutine
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.injectOptions["cursorl"]).toBe(true);
    expect(output.injectOptions["subroutine"]).toBe(true);
  });

  it("injectopt #6 - cursork (deprecated) still works", async () => {
    const compiler = new Z80Assembler();
    const source = ".injectopt cursork";

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.injectOptions["cursork"]).toBe(true);
  });

  it("injectopt #7 - both cursork and cursorl work together", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .injectopt cursorl
      .injectopt cursork
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.injectOptions["cursorl"]).toBe(true);
    expect(output.injectOptions["cursork"]).toBe(true);
  });

  const dgCases = [
    { source: ".dg ....OOOO", expected: [0x0f] },
    { source: ".dg ----OOOO", expected: [0x0f] },
    { source: ".dg ___OOOO", expected: [0x1e] },
    { source: ".dg -OOOO", expected: [0x78] },
    { source: ".dg ___####", expected: [0x1e] },
    { source: ".dg ..OOOO", expected: [0x3c] },
    { source: ".dg .OOOO", expected: [0x78] },
    { source: ".dg ...XXXX", expected: [0x1e] },
    { source: ".dg ..xxxx", expected: [0x3c] },
    { source: ".dg .qqqq", expected: [0x78] },
    { source: ".dg OOOO", expected: [0xf0] },

    { source: ".dg   ....OOOO", expected: [0x0f] },
    { source: ".dg  .... OOOO ", expected: [0x0f] },

    { source: ".dg ....OOOO ..OO", expected: [0x0f, 0x30] },
    { source: ".dg ....OOOO ..OOO", expected: [0x0f, 0x38] },
    { source: ".dg ....OOOO ..OOOO", expected: [0x0f, 0x3c] },
    { source: ".dg ....O OOO..OOO", expected: [0x0f, 0x38] },
    { source: ".dg ....OO OO..OOOO", expected: [0x0f, 0x3c] },
    { source: ".dg ....OO OO..OOOO; This is comment", expected: [0x0f, 0x3c] },
    {
      source: ".dg ....OO OO..OOOO // This is comment",
      expected: [0x0f, 0x3c]
    }
  ];
  dgCases.forEach((dgc) =>
    it(`.defg: ${dgc.source}`, async () => {
      await await testCodeEmit(dgc.source, ...dgc.expected);
    })
  );

  const dgxCases = [
    { source: '.dgx "....OOOO"', expected: [0x0f] },
    { source: '.dgx ">....OOOO"', expected: [0x0f] },
    { source: '.dgx "<----OOOO"', expected: [0x0f] },
    { source: '.dgx "___OOOO"', expected: [0x1e] },
    { source: '.dgx "..OOOO"', expected: [0x3c] },
    { source: '.dgx "-OOOO"', expected: [0x78] },
    { source: '.dgx "<___####"', expected: [0x1e] },
    { source: '.dgx "<..OOOO"', expected: [0x3c] },
    { source: '.dgx "<.OOOO"', expected: [0x78] },
    { source: '.dgx ">...XXXX"', expected: [0x0f] },
    { source: '.dgx ">..xxxx"', expected: [0x0f] },
    { source: '.dgx ">.qqqq"', expected: [0x0f] },
    { source: '.dgx ">OOOO"', expected: [0x0f] },

    { source: '.dgx " ....OOOO"', expected: [0x0f] },
    { source: '.dgx " .... OOOO "', expected: [0x0f] },

    { source: '.dgx "....OOOO ..OO"', expected: [0x0f, 0x30] },
    { source: '.dgx "....OOOO ..OOO"', expected: [0x0f, 0x38] },
    { source: '.dgx "....OOOO ..OOOO"', expected: [0x0f, 0x3c] },
    { source: '.dgx ">....OOOO ..OO"', expected: [0x00, 0xf3] },
    { source: '.dgx ">....O OOO..OOO"', expected: [0x01, 0xe7] },
    { source: '.dgx ">....OO OO..OOOO"', expected: [0x03, 0xcf] }
  ];
  dgxCases.forEach((dgxc) =>
    it(`.defg: ${dgxc.source}`, async () => {
      await await testCodeEmit(dgxc.source, ...dgxc.expected);
    })
  );

  it("onsuccess #1", async () => {
    const compiler = new Z80Assembler();
    const source = '.onsuccess "somecommand"';

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.onSuccessCommands.length).toBe(1);
    expect(output.onSuccessCommands[0]).toBe("somecommand");
  });

  it("onsuccess #2", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .onsuccess "somecommand"
    .ONSUCCESS "command2"
    onsuccess "command3"
    ONSUCCESS "command4"
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.onSuccessCommands.length).toBe(4);
    expect(output.onSuccessCommands[0]).toBe("somecommand");
    expect(output.onSuccessCommands[1]).toBe("command2");
    expect(output.onSuccessCommands[2]).toBe("command3");
    expect(output.onSuccessCommands[3]).toBe("command4");
  });

  it("onsuccess #3", async () => {
    const compiler = new Z80Assembler();
    const source = `
      ld a,b
    .onsuccess "somecommand"
      ld a,b
    .ONSUCCESS "command2"
      ld a,b
    onsuccess "command3"
      ld a,b
    ONSUCCESS "command4"
      ld a,b
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.onSuccessCommands.length).toBe(4);
    expect(output.onSuccessCommands[0]).toBe("somecommand");
    expect(output.onSuccessCommands[1]).toBe("command2");
    expect(output.onSuccessCommands[2]).toBe("command3");
    expect(output.onSuccessCommands[3]).toBe("command4");
  });
});

import "mocha";
import * as expect from "expect";

import { Z80Assembler } from "../../src/z80lang/assembler/assembler";
import { testCodeEmit } from "./test-helpers";
import { some } from "lodash";

describe("Assembler - pragmas", () => {
  it("org - existing segment", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("equ - immediate evaluation", () => {
    const compiler = new Z80Assembler();
    const source = `
      MySymbol .equ 200
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.symbols["MySymbol"].value.value).toBe(200);
  });

  it("bank - existing segment #1", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 1
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xc000);
    expect(output.segments[1].bank).toBe(1);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - existing segment #2", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 7
      .org #E000
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xe000);
    expect(output.segments[1].bank).toBe(7);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - new segment #1", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 3
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xc000);
    expect(output.segments[0].bank).toBe(3);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - new segment #2", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4
      .org $e000
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xe000);
    expect(output.segments[0].bank).toBe(4);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - multiple pragma", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 1
      nop
      .bank 3
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0xc000);
    expect(output.segments[0].bank).toBe(1);
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xc000);
    expect(output.segments[1].bank).toBe(3);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - with invalid model #1", () => {
    const compiler = new Z80Assembler();
    const source = `
      .bank 4
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2021").toBe(true);
  });

  it("bank - with invalid model #2", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum48
      .bank 4
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2021").toBe(true);
  });

  it("bank - with label", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      myLabel .bank 4
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2018").toBe(true);
  });

  it("bank - invalid value #1", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank -1
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2019").toBe(true);
  });

  it("bank - invalid value #2", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 8
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2019").toBe(true);
  });

  it("bank - reuse bank", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 1
      .bank 3
      .bank 1
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2022").toBe(true);
  });

  it("bank - maximum length works", () => {
    // TODO: Implement this test
  });

  it("bank - maximum length overflows", () => {
    // TODO: Implement this test
  });

  it("bank - offseted bank with existing segment #1", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 1, #400
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xc400);
    expect(output.segments[1].bank).toBe(1);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - offseted bank with existing segment #2", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 1, #400
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xc400);
    expect(output.segments[1].bank).toBe(1);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - offseted bank with existing segment #3", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .org #6400
      nop
      .bank 7, #400
      .org #E000
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].bank).toBeUndefined();
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xe000);
    expect(output.segments[1].bank).toBe(7);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - offseted bank with new segment #1", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 3, #400
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xc400);
    expect(output.segments[0].bank).toBe(3);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - offseted bank with new segment #2", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 1, #400
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xc400);
    expect(output.segments[0].bank).toBe(1);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - offseted bank with new segment #3", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, #400
      .org #e000
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0xe000);
    expect(output.segments[0].bank).toBe(4);
    expect(output.segments[0].displacement).toBeUndefined();
  });

  it("bank - multiple offseted pragmas", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 1, #2000
      nop
      .bank 3, #1000
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].startAddress).toBe(0xe000);
    expect(output.segments[0].bank).toBe(1);
    expect(output.segments[0].displacement).toBeUndefined();
    expect(output.segments[1].startAddress).toBe(0xd000);
    expect(output.segments[1].bank).toBe(3);
    expect(output.segments[1].displacement).toBeUndefined();
  });

  it("bank - offseted with invalid model #1", () => {
    const compiler = new Z80Assembler();
    const source = `
      .bank 4, #1000
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2021").toBe(true);
  });

  it("bank - offseted with invalid model #2", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum48
      .bank 4, #1000
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2021").toBe(true);
  });

  it("bank - offseted with invalid value #1", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, #5678
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2020").toBe(true);
  });

  it("bank - offseted with invalid value #2", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, -#1000
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2020").toBe(true);
  });

  it("bank - offseted with invalid value #3", () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .bank 4, #4000
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2020").toBe(true);
  });

  it("bank - maximum offseted bank length", () => {
    // TODO: Implement this test
  });

  it("bank - maximum offseted bank length overflows", () => {
    // TODO: Implement this test
  });

  it("xorg - negative value", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg -100
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].xorgValue).toBe(0x10000 - 100);
  });

  it("xorg - positive value", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg #1000
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].xorgValue).toBe(0x1000);
  });

  it("xorg - zero value", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg 0
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].xorgValue).toBe(0x0000);
  });

  it("xorg - multiple in the same segment", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg 0
      nop
      .xorg #1000
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2024").toBe(true);
  });

  it("xorg - multiple in separate segments", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .xorg 0
      nop
      .org #6600
      .xorg #1000
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
  });

  it("ent - single pragma", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .ent #6400
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.entryAddress).toBe(0x6400);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("ent - multiple pragma", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .ent #6400
      nop
      .ent #1234
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.entryAddress).toBe(0x1234);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("ent - works with current address", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .ent $
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.entryAddress).toBe(0x6401);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("xent - single pragma", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .xent #6400
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.exportEntryAddress).toBe(0x6400);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("xent - multiple pragma", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .xent #6400
      nop
      .xent #1234
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.exportEntryAddress).toBe(0x1234);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("xent - works with current address", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      nop
      .xent $
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.exportEntryAddress).toBe(0x6401);
    expect(output.segments[0].startAddress).toBe(0x6400);
  });

  it("disp - negative value", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .disp -100
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].displacement).toBe(0x10000 - 100);
  });

  it("disp - positive value", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .disp #1000
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].displacement).toBe(0x1000);
  });

  it("disp - zero value", () => {
    const compiler = new Z80Assembler();
    const source = `
      .org #6400
      .disp 0
      nop
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(1);
    expect(output.segments[0].startAddress).toBe(0x6400);
    expect(output.segments[0].displacement).toBe(0x0000);
  });

  const varPragmas = [".var", "=", ":="];
  varPragmas.forEach((varPragma) => {
    it(`var - initial definition (${varPragma})`, () => {
      const compiler = new Z80Assembler();
      const source = `
        MySymbol ${varPragma} 100+100
        nop
      `;

      const output = compiler.compile(source);

      expect(output.errorCount).toBe(0);
      expect(output.segments.length).toBe(1);
      expect(output.getSymbol("MySymbol").value.value).toBe(200);
    });

    it(`var - re-assignment (${varPragma})`, () => {
      const compiler = new Z80Assembler();
      const source = `
        MySymbol ${varPragma} 100+100
        nop
        MySymbol ${varPragma} MySymbol*3
      `;

      const output = compiler.compile(source);

      expect(output.errorCount).toBe(0);
      expect(output.segments.length).toBe(1);
      expect(output.getSymbol("MySymbol").value.value).toBe(600);
    });

    it(`var - no label (${varPragma})`, () => {
      const compiler = new Z80Assembler();
      const source = `
        ${varPragma} 100+100
      `;

      const output = compiler.compile(source);

      expect(output.errorCount).toBe(1);
      expect(output.errors[0].errorCode === "Z2026").toBe(true);
    });

    it(`var - local label (${varPragma})`, () => {
      const compiler = new Z80Assembler();
      const source = `
        \`local ${varPragma} 100+100
      `;

      const output = compiler.compile(source);

      expect(output.errorCount).toBe(0);
    });
  });

  it("skip - no fill value", () => {
    const source = `.skip $+#05`;
    testCodeEmit(source, 0xff, 0xff, 0xff, 0xff, 0xff);
  });

  it("skip - with fill value", () => {
    const source = `.skip $+#04, #3a`;
    testCodeEmit(source, 0x3a, 0x3a, 0x3a, 0x3a);
  });

  it("skip - negative value", () => {
    const compiler = new Z80Assembler();
    const source = `.skip $-#04`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2028").toBe(true);
  });

  it("skip - non-immediate value", () => {
    const compiler = new Z80Assembler();
    const source = `.skip MySymbol+#04`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z3001").toBe(true);
  });

  it("skip - non-immediate value and fill", () => {
    const compiler = new Z80Assembler();
    const source = `.skip MySymbol+#04, #3a`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z3001").toBe(true);
  });

  it("defb - immediate evaluation", () => {
    const source = `.defb #01, #2345, #AE, 122`;
    testCodeEmit(source, 0x01, 0x45, 0xae, 122);
  });

  it("defb - fails with string", () => {
    const compiler = new Z80Assembler();
    const source = `.defb "Hello"`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2029").toBe(true);
  });

  it("defb - flexible mode", () => {
    const source = `
    .zxbasic
    .defb "\\x12\\i\\Iabc\\P"
    `;

    testCodeEmit(source, 0x12, 0x10, 0x14, 0x61, 0x62, 0x63, 0x60);
  });

  it("defw - immediate evaluation", () => {
    const source = `.defw #A001, #2345, #AE12, 122`;
    testCodeEmit(source, 0x01, 0xa0, 0x45, 0x23, 0x12, 0xae, 122, 0);
  });

  it("defw - fails with string", () => {
    const compiler = new Z80Assembler();
    const source = `.defw "Hello"`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2029").toBe(true);
  });

  it("defw - with function", () => {
    const source = `.defw 1000*sin(1.5)`;
    testCodeEmit(source, 0xe5, 0x03);
  });

  it("defw - fails with function", () => {
    const compiler = new Z80Assembler();
    const source = `.DEFW 1000/sinx(1.5)`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z3001").toBe(true);
  });

  it("defm - immediate evaluation", () => {
    const source = `.defm "\\x12\\i\\Iabc\\P"`;
    testCodeEmit(source, 0x12, 0x10, 0x14, 0x61, 0x62, 0x63, 0x60);
  });

  it("defm - fails with non-string", () => {
    const compiler = new Z80Assembler();
    const source = `.defm 1234`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2030").toBe(true);
  });

  it("defm - flexible mode", () => {
    const source = `
    .zxbasic
    .defm 123
    `;

    testCodeEmit(source, 123);
  });

  it("defn - immediate evaluation", () => {
    const source = `.defn "\\x12\\i\\Iabc\\P"`;
    testCodeEmit(source, 0x12, 0x10, 0x14, 0x61, 0x62, 0x63, 0x60, 0x00);
  });

  it("defn - fails with non-string", () => {
    const compiler = new Z80Assembler();
    const source = `.defn 1234`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2030").toBe(true);
  });

  it("defn - flexible mode", () => {
    const source = `
    .zxbasic
    .defn 123
    `;

    testCodeEmit(source, 123, 0);
  });

  it("defc - immediate evaluation", () => {
    const source = `.defc "\\x12\\i\\Iabc\\P"`;
    testCodeEmit(source, 0x12, 0x10, 0x14, 0x61, 0x62, 0x63, 0xe0);
  });

  it("defc - fails with non-string", () => {
    const compiler = new Z80Assembler();
    const source = `.defc 1234`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2030").toBe(true);
  });

  it("defc - flexible mode", () => {
    const source = `
    .zxbasic
    .defc 0x22
    `;

    testCodeEmit(source, 0xa2);
  });

  it("defh - immediate evaluation", () => {
    const source = `.defh "0105C1af27d3"`;
    testCodeEmit(source, 0x01, 0x05, 0xc1, 0xaf, 0x27, 0xd3);
  });

  it("defh - empty string", () => {
    const source = `.defh ""`;
    testCodeEmit(source);
  });

  it("defh - fails with non-string", () => {
    const compiler = new Z80Assembler();
    const source = `.defh 1234`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2031").toBe(true);
  });

  it("defh - fails with odd length", () => {
    const compiler = new Z80Assembler();
    const source = `.defh "010"`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2032").toBe(true);
  });

  it("defh - fails with non-hexa char", () => {
    const compiler = new Z80Assembler();
    const source = `.defh "00Qa"`;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode === "Z2032").toBe(true);
  });

  it("defs - immediate evaluation #1", () => {
    const source = `.defs 6`;
    testCodeEmit(source, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
  });

  it("defs - immediate evaluation #2", () => {
    const source = `.defs 6, #2a`;
    testCodeEmit(source, 0x2a, 0x2a, 0x2a, 0x2a, 0x2a, 0x2a);
  });

  it("defs - indirect evaluation #1", () => {
    const source = `
    count .equ 3
    .defs count, #2a
    `;
    testCodeEmit(source, 0x2a, 0x2a, 0x2a);
  });

  it("defs - indirect evaluation #2", () => {
    const source = `
    count .equ 3
    .defs count
    `;
    testCodeEmit(source, 0x00, 0x00, 0x00);
  });

  it("defs - indirect evaluation #3", () => {
    const source = `
    count .equ 3
    value .equ #2a
    .defs count, value
    `;
    testCodeEmit(source, 0x2a, 0x2a, 0x2a);
  });

  it("fillb - immediate evaluation #1", () => {
    const source = `.fillb 6, #2a`;
    testCodeEmit(source, 0x2a, 0x2a, 0x2a, 0x2a, 0x2a, 0x2a);
  });

  it("fillb - indirect evaluation #1", () => {
    const source = `
    count .equ 3
    .fillb count, #2a
    `;
    testCodeEmit(source, 0x2a, 0x2a, 0x2a);
  });

  it("fillb - indirect evaluation #2", () => {
    const source = `
    count .equ 3
    value .equ #2a
    .fillb count, value
    `;
    testCodeEmit(source, 0x2a, 0x2a, 0x2a);
  });

  it("fillw - immediate evaluation #1", () => {
    const source = `.fillw 3,#80A5`;
    testCodeEmit(source, 0xa5, 0x80, 0xa5, 0x80, 0xa5, 0x80);
  });

  it("fillw - indirect evaluation #1", () => {
    const source = `
    count .equ 3
    .fillw count, #80a5
    `;
    testCodeEmit(source, 0xa5, 0x80, 0xa5, 0x80, 0xa5, 0x80);
  });

  it("fillw - indirect evaluation #2", () => {
    const source = `
    count .equ 3
    value .equ #80a5
    .fillw count, value
    `;
    testCodeEmit(source, 0xa5, 0x80, 0xa5, 0x80, 0xa5, 0x80);
  });

  it("align - no expression", () => {
    const compiler = new Z80Assembler();
    const source = `
      halt
      .align
      halt
    `;

    const output = compiler.compile(source);

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
    { entry: "halt", align: 0x10, exit: "", head: [0x76], tail: [] },
  ];
  alignCases.forEach((alc, index) => {
    it(`align: #${index + 1}`, () => {
      const compiler = new Z80Assembler();
      const source = `
        ${alc.entry}
        .align ${alc.align}
        ${alc.exit}
      `;
      const output = compiler.compile(source);

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
    { source: '.tracehex "Hello"', expected: "48656c6c6f" },
  ];
  traceCases.forEach((tc) => {
    it(`trace: ${tc.source}`, () => {
      const compiler = new Z80Assembler();
      let messageReceived = "";
      compiler.setTraceHandler((msg: string) => (messageReceived += msg));
      const output = compiler.compile(tc.source);

      expect(output.errorCount).toBe(0);
      expect(output.segments.length).toBe(1);
      expect(messageReceived).toBe(tc.expected);
    });
  });

  const errorCases = [
    { source: ".error true", expected: "ERROR: true" },
    {
      source: '.error "This is an error"',
      expected: "ERROR: This is an error",
    },
    { source: ".error 123", expected: "ERROR: 123" },
    { source: ".error 123.5+1", expected: "ERROR: 124.5" },
  ];
  errorCases.forEach((ec) => {
    it(`error: ${ec.source}`, () => {
      const compiler = new Z80Assembler();
      const output = compiler.compile(ec.source);
      expect(output.errorCount).toBe(1);
      expect(output.errors[0].errorCode === "Z4000").toBe(true);
      expect(output.errors[0].message).toBe(ec.expected);
    });
  });

  it("injectopt #1", () => {
    const compiler = new Z80Assembler();
    const source = ".injectopt cursork";

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
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
      expected: [0x0f, 0x3c],
    },
  ];
  dgCases.forEach((dgc) =>
    it(`.defg: ${dgc.source}`, () => {
      testCodeEmit(dgc.source, ...dgc.expected);
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

    { source: ".dgx \"....OOOO ..OO\"", expected: [0x0f, 0x30] },
    { source: ".dgx \"....OOOO ..OOO\"", expected: [0x0f, 0x38] },
    { source: ".dgx \"....OOOO ..OOOO\"", expected: [0x0f, 0x3c] },
    { source: ".dgx \">....OOOO ..OO\"", expected: [0x00, 0xF3] },
    { source: ".dgx \">....O OOO..OOO\"", expected: [0x01, 0xE7] },
    { source: ".dgx \">....OO OO..OOOO\"", expected: [0x03, 0xCF] },
  ];
  dgxCases.forEach((dgxc) =>
  it(`.defg: ${dgxc.source}`, () => {
    testCodeEmit(dgxc.source, ...dgxc.expected);
  })
);

});

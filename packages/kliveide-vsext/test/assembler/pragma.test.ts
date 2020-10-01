import "mocha";
import * as expect from "expect";

import { Z80Assembler } from "../../src/z80lang/assembler/assembler";

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
    // TODO: Implement this test
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
    // TODO: Implement this test
  });

  it("bank - offseted bank with existing segment #2", () => {
    // TODO: Implement this test
  });

  it("bank - offseted bank with existing segment #3", () => {
    // TODO: Implement this test
  });

  it("bank - offseted bank with new segment #1", () => {
    // TODO: Implement this test
  });

  it("bank - offseted bank with new segment #2", () => {
    // TODO: Implement this test
  });

  it("bank - offseted bank with new segment #3", () => {
    // TODO: Implement this test
  });

  it("bank - multiple offseted pragmas", () => {
    // TODO: Implement this test
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


});

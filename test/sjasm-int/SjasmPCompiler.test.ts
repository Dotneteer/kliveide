import { describe, it, expect } from "vitest";
import {
  extractSegmentsFromListFile,
  SjasmPCompiler
} from "@main/sjasmp-integration/SjasmPCompiler";

describe("Sjasmp list file parsing", () => {
  it("Single comment line", () => {
    const source = "# This is a comment";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(0);
  });

  it("Single instruction line #1", () => {
    const source = "4+    8005";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(0);
  });

  it("Single instruction line #2", () => {
    const source = "2     8000 78               ld a,b";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(1);
    expect(result[0].origin).toEqual(0x8000);
    expect(result[0].size).toEqual(1);
  });

  it("Single instruction line #3", () => {
    const source = "3     8001 01 02 03 04      defb 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(1);
    expect(result[0].origin).toEqual(0x8001);
    expect(result[0].size).toEqual(4);
  });

  it("Single instruction line #4", () => {
    const source = "3     8001 01 02 03 04";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(1);
    expect(result[0].origin).toEqual(0x8001);
    expect(result[0].size).toEqual(4);
  });

  it("2 lines #1", () => {
    const source =
      "2     8000 78               ld a,b\n" +
      "3     8001 01 02 03 04      defb 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(1);
    expect(result[0].origin).toEqual(0x8000);
    expect(result[0].size).toEqual(5);
  });

  it("2 lines #2", () => {
    const source = "2     8000 78\n" + "3     8001 01 02 03 04";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(1);
    expect(result[0].origin).toEqual(0x8000);
    expect(result[0].size).toEqual(5);
  });

  it("org #1", () => {
    const source = "1     0000    org $8000\n" + "3     8000 01";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(1);
    expect(result[0].origin).toEqual(0x8000);
    expect(result[0].size).toEqual(1);
  });

  it("org #2", () => {
    const source = "1     0000    ORG $8000\n" + "3     8000 01";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(1);
    expect(result[0].origin).toEqual(0x8000);
    expect(result[0].size).toEqual(1);
  });

  it("org #3", () => {
    const source = "1     0000    org $8000\n" + "2     8000 01\n" + "3     8001    org $8100";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(1);
    expect(result[0].origin).toEqual(0x8000);
    expect(result[0].size).toEqual(1);
  });

  it("org #4", () => {
    const source =
      "1     0000    org $8000\n" +
      "2     8000 01\n" +
      "3     8001    org $8100\n" +
      "4     8100 01 02 03";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(2);
    expect(result[0].origin).toEqual(0x8000);
    expect(result[0].size).toEqual(1);
    expect(result[1].origin).toEqual(0x8100);
    expect(result[1].size).toEqual(3);
  });

  it("org #5", () => {
    const source = "1     0000    org $8000";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(0);
  });

  it("org #6", () => {
    const source =
      "1     0000    Start org $8000\n" +
      "2     8000 01\n" +
      "3     8001    Cont: org $8100\n" +
      "4     8100 01 02 03";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(2);
    expect(result[0].origin).toEqual(0x8000);
    expect(result[0].size).toEqual(1);
    expect(result[1].origin).toEqual(0x8100);
    expect(result[1].size).toEqual(3);
  });

  it("org #7", () => {
    const source =
      "2     0000    device ZXSPECTRUM48\n" +
      "2     0000    Start org $8000\n" +
      "3     8000 01\n" +
      "4     8001    Cont: org $8100\n" +
      "5     8100 01 02 03";
    const result = extractSegmentsFromListFile(source);

    expect(result.length).toEqual(2);
    expect(result[0].origin).toEqual(0x8000);
    expect(result[0].size).toEqual(1);
    expect(result[1].origin).toEqual(0x8100);
    expect(result[1].size).toEqual(3);
  });

  const lineBpCases = [
    { line: "label1", expected: false },
    { line: "label1:", expected: false },
    { line: "label1 ld a,b", expected: true },
    { line: "label1: ld a,b", expected: true },
    { line: "label1:ld a,b", expected: true },
    { line: " ld a,b", expected: true }
  ];
  lineBpCases.forEach(({ line, expected }) => {
    it(`'${line}' can have bp`, async () => {
      const comp = new SjasmPCompiler();
      const result = await comp.lineCanHaveBreakpoint(line);
      expect(result).toEqual(expected);
    });
  });

  const keywordCases = [
    "align",
    "assert",
    "binary",
    "bplist",
    "cspectmap",
    "defdevice",
    "define",
    "defl",
    "dephase",
    "device",
    "disp",
    "display",
    "dup",
    "edup",
    "emptytap",
    "emptytrd",
    "encoding",
    "end",
    "endlua",
    "endmod",
    "endmodule",
    "endt",
    "ent",
    "equ",
    "export",
    "fpos",
    "incbin",
    "inchob",
    "include",
    "includelua",
    "inctrd",
    "insert",
    "labelslist",
    "lua",
    "memorymap",
    "mmu",
    "module",
    "opt",
    "org",
    "outend",
    "output",
    "page",
    "phase",
    "relocate_end",
    "relocate_start",
    "relocate_table",
    "rept",
    "save3dos",
    "saveasmdos",
    "savebin",
    "savecdt",
    "savepcsna",
    "savecpr",
    "savedev",
    "savehob",
    "savenex",
    "savesna",
    "savetap",
    "savetrd",
    "setbp",
    "setbreakpoint",
    "shellexec",
    "size",
    "sldopt",
    "slot",
    "tapend",
    "tapout",
    "textarea",
    "undefine",
    "unphase",
    "while"
  ];
  keywordCases.forEach((kwd) => {
    it(`${kwd}' cannot have bp #1`, async () => {
      const comp = new SjasmPCompiler();
      const result = await comp.lineCanHaveBreakpoint(` ${kwd} blabla`);
      expect(result).toEqual(false);
    });
    it(`${kwd}' cannot have bp #2`, async () => {
      const comp = new SjasmPCompiler();
      const result = await comp.lineCanHaveBreakpoint(`label ${kwd} blabla`);
      expect(result).toEqual(false);
    });
    it(`${kwd}' cannot have bp #3`, async () => {
      const comp = new SjasmPCompiler();
      const result = await comp.lineCanHaveBreakpoint(`label: ${kwd} blabla`);
      expect(result).toEqual(false);
    });
    it(`${kwd}' cannot have bp #4`, async () => {
      const comp = new SjasmPCompiler();
      const result = await comp.lineCanHaveBreakpoint(`label:${kwd} blabla`);
      expect(result).toEqual(false);
    });
  });
});

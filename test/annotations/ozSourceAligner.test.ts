import { describe, expect, it } from "vitest";

import {
  alignOzModule,
  evaluateOzExpression,
  evaluateRelocatable,
  instructionShape,
  shortLabelName,
  splitArguments,
  splitComment,
  type OzDecodedInstruction
} from "@common/roms/ozSourceAligner";

/*
 * The OZ source aligner (`src/common/roms/ozSourceAligner.ts`, `dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`
 * Phase 2): mpm source placed on ROM bytes without assembling it. The decoder is a table here; the
 * import script gives it Klive's disassembler.
 */

/** A bank with these bytes at its start, and a decoder that knows these instructions */
function bank(bytes: number[], listing: Record<number, OzDecodedInstruction>) {
  const b = new Uint8Array(0x4000).fill(0xff);
  b.set(bytes, 0);
  return { bytes: b, decodeAt: (offset: number) => listing[offset] };
}

const noIncludes = { include: () => undefined };

describe("reading mpm source", () => {
  it("splits a comment off, not inside a string or a character, nor at af'", () => {
    expect(splitComment('  defm "a;b" ; text')).toEqual({ code: '  defm "a;b" ', comment: " text" });
    expect(splitComment("  cp ';' ; semicolon")).toEqual({ code: "  cp ';' ", comment: " semicolon" });
    expect(splitComment("  ex af, af' ; swap")).toEqual({ code: "  ex af, af' ", comment: " swap" });
  });

  it("splits arguments at top-level commas only", () => {
    expect(splitArguments("a, (ix+3)")).toEqual(["a", "(ix+3)"]);
    expect(splitArguments('"x,y", 1, (2,3)')).toEqual(['"x,y"', "1", "(2,3)"]);
  });

  it("evaluates mpm expressions", () => {
    const symbols = new Map<string, string | number>([["A", "$10 + B"], ["B", 2]]);
    expect(evaluateOzExpression("$0021-$PC", symbols, 0x14)).toBe(0x0d);
    expect(evaluateOzExpression("A * 2 + @101", symbols)).toBe(0x29);
    expect(evaluateOzExpression("$73 & $3F", symbols)).toBe(0x33);
    expect(evaluateOzExpression("1 << 4 | 1", symbols)).toBe(17);
    expect(evaluateOzExpression("'A'+1", symbols)).toBe(66);
    expect(evaluateOzExpression("Unknown + 1", symbols)).toBeUndefined();
    expect(evaluateOzExpression("!__GUARD__", symbols, undefined, true)).toBe(1);
  });

  it("gives instructions a shape, with every value one N", () => {
    expect(instructionShape("ld", "a, (ix+3)")).toBe("ld a,(ix+N)");
    expect(instructionShape("ld", "(ix),l")).toBe("ld (ix+N),l");
    expect(instructionShape("jp", "nz, FPError")).toBe("jp nz,N");
    expect(instructionShape("jp", "(hl)")).toBe(instructionShape("jp", "hl"));
    expect(instructionShape("jp", "(ix)")).toBe("jp (ix)");
    expect(instructionShape("ex", "af, af'")).toBe("ex af,af'");
    expect(instructionShape("out", "($B0), a")).toBe("out (N),a");
  });
});

describe("aligning a module", () => {
  const source = [
    "        module Test",
    "        org     $C000",
    "",
    "; Returns with Fc=0",
    "; (a header of two lines)",
    ".Start",
    "        ld      a, Value        ; the value",
    "        jr      Done",
    "        defs    ($0008-$PC) ($00)",
    ".Table",
    "        defb    1, 2, \"AB\"",
    ".Done",
    "        ret"
  ].join("\n");
  // --- ld a,5 / jr +4 (to $0008+4 = Done at $000C) / two zero bytes to $0008 / 01 02 41 42 / ret
  const rom = bank([0x3e, 0x05, 0x18, 0x08, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x41, 0x42, 0xc9], {
    0: { length: 2, text: "ld a,$05" },
    2: { length: 2, text: "jr LC00C", target: 0x0c },
    12: { length: 1, text: "ret" }
  });

  it("places labels, code and data, and keeps comments and headers", () => {
    const result = alignOzModule({
      path: "test.asm",
      text: source.replace("Value", "5"),
      bytes: rom.bytes,
      defines: [],
      reader: noIncludes,
      decodeAt: rom.decodeAt
    });
    expect(result.stop).toBeUndefined();
    expect(result.org).toBe(0xc000);
    expect(result.start).toBe(0);
    expect(result.end).toBe(13);
    expect(result.labels.map((l) => [l.name, l.offset])).toEqual([
      ["Start", 0],
      ["Table", 8],
      ["Done", 12]
    ]);
    expect(result.labels[0].header).toEqual(["Returns with Fc=0", "(a header of two lines)"]);
    expect(result.lines.map((l) => [l.offset, l.length, l.kind])).toEqual([
      [0, 2, "code"],
      [2, 2, "code"],
      [4, 4, "data"],
      [8, 4, "data"],
      [12, 1, "code"]
    ]);
    expect(result.lines[0].comment).toBe("the value");
    expect(result.targetMismatches).toEqual([]);
  });

  it("stops at the first line whose bytes are not the ROM's", () => {
    const result = alignOzModule({
      path: "test.asm",
      text: source.replace("Value", "5").replace("defb    1, 2", "defb    1, 3"),
      bytes: rom.bytes,
      defines: [],
      reader: noIncludes,
      decodeAt: rom.decodeAt
    });
    expect(result.stop?.offset).toBe(8);
    expect(result.stop?.reason).toMatch(/byte 1 is \$02 in the ROM, \$03 in the source/);
    // --- The defb it stopped at, the .Done label and the ret
    expect(result.unplaced).toBe(3);
  });

  it("stops where the instruction's shape differs", () => {
    const result = alignOzModule({
      path: "test.asm",
      text: source.replace("ld      a, Value", "ld      b, 5"),
      bytes: rom.bytes,
      defines: [],
      reader: noIncludes,
      decodeAt: rom.decodeAt
    });
    expect(result.stop?.offset).toBe(0);
    expect(result.stop?.reason).toMatch(/ld b,N \/ ld a,N/);
  });

  it("reports a jump whose decoded target is not its label", () => {
    const wrong = bank(Array.from(rom.bytes.subarray(0, 13)), {
      0: { length: 2, text: "ld a,$05" },
      2: { length: 2, text: "jr LC00A", target: 0x0a },
      12: { length: 1, text: "ret" }
    });
    const result = alignOzModule({
      path: "test.asm",
      text: source.replace("Value", "5"),
      bytes: wrong.bytes,
      defines: [],
      reader: noIncludes,
      decodeAt: wrong.decodeAt
    });
    expect(result.targetMismatches.map((m) => m.reason)).toEqual(["the target is $000A, the label is at $000C"]);
  });

  it("reads includes, IF/ELSE on the defines, defc and defvars", () => {
    const def = [
      "IF !__TEST_DEF__",
      "define __TEST_DEF__",
      "IF OZ_SLOT1",
      "defc BASE = $8000",
      "ELSE",
      "defc BASE = $C000",
      "ENDIF",
      "defvars 0",
      "        fld_a  ds.b 1",
      "        fld_w  ds.w 2",
      "        fld_b  ds.b 1",
      "enddef",
      "ENDIF"
    ].join("\n");
    const reader = { include: (_from: string, name: string) => (name === "test.def" ? { path: "test.def", text: def } : undefined) };
    const text = ['        include "test.def"', '        include "test.def"', "        org BASE", "        defb fld_b, fld_w"].join("\n");
    const data = bank([0x05, 0x01], {});
    const result = alignOzModule({ path: "m.asm", text, bytes: data.bytes, defines: ["OZ_SLOT0"], reader, decodeAt: data.decodeAt });
    expect(result.stop).toBeUndefined();
    expect(result.org).toBe(0xc000);
    expect(result.end).toBe(2);
    expect(result.problems).toEqual([]);
  });
});

describe("mpm's spellings", () => {
  it("accepts the accumulator spelled out or left out, and the index halves either way", () => {
    expect(instructionShape("sub", "a, c")).toBe(instructionShape("sub", "c"));
    expect(instructionShape("or", "MAT_ALLOCFIXED, a")).toBe("or N");
    expect(instructionShape("sbc", "c")).toBe(instructionShape("sbc", "a,c"));
    expect(instructionShape("ld", "a, ixl")).toBe(instructionShape("ld", "a,xl"));
  });

  it("reads a comma or a colon typed for a space or a semicolon, and words after scf", () => {
    const text = ["        org $C000", "        djnz,Loop", ".Loop   pop af   : discard AF", "        scf return error"].join("\n");
    const rom = bank([0x10, 0x00, 0xf1, 0x37], {
      0: { length: 2, text: "djnz LC002", target: 2 },
      2: { length: 1, text: "pop af" },
      3: { length: 1, text: "scf" }
    });
    const result = alignOzModule({ path: "m.asm", text, bytes: rom.bytes, defines: [], reader: noIncludes, decodeAt: rom.decodeAt });
    expect(result.stop).toBeUndefined();
    expect(result.lines.map((l) => l.comment)).toEqual([undefined, "discard AF", "return error"]);
  });
});

describe("relocatable values", () => {
  const symbols = new Map<string, string | number | { offset: number }>([["Label", { offset: 0x10 }], ["End", { offset: 0x18 }]]);

  it("gives an address the segment's base, a difference or an offset none", () => {
    expect(evaluateRelocatable("Label", symbols, 0, 0xc000)).toBe(0xc010);
    expect(evaluateRelocatable("Label+3", symbols, 0, 0xc000)).toBe(0xc013);
    expect(evaluateRelocatable("End - $ - 1", symbols, 0x10, 0xc000)).toBe(7);
    expect(evaluateRelocatable("$0021-$PC", symbols, 0x14, 0xc000)).toBe(0x0d);
  });
});

describe("the OZ call forms and macros", () => {
  const macros = [
    "macro dt_nam (string)",
    "  if !\\%",
    '    error "DT_NAM: Name not specified"',
    "    exitmacro",
    "  endif",
    ".\\record",
    "        defb    $10",
    "        defb    \\record_end - $-1",
    '        defm    "\\string",0',
    ".\\record_end",
    "endmacro"
  ].join("\n");
  const reader = { include: (_from: string, name: string) => (name === "macros.def" ? { path: "macros.def", text: macros } : undefined) };

  it("places oz, call_oz(...) and fpp by their bytes, the call checked where its code is known", () => {
    const text = ["        org $C000", "defc GN_Sop = $3A09", "        oz      GN_Sop", "        call_oz(GN_Sop)", "        fpp     $45"].join("\n");
    const rom = bank([0xe7, 0x09, 0x3a, 0xe7, 0x09, 0x3a, 0xdf, 0x45], {});
    const result = alignOzModule({ path: "m.asm", text, bytes: rom.bytes, defines: [], reader: noIncludes, decodeAt: rom.decodeAt });
    expect(result.stop).toBeUndefined();
    expect(result.lines.map((l) => [l.offset, l.length])).toEqual([[0, 3], [3, 3], [6, 2]]);
    const wrong = alignOzModule({ path: "m.asm", text: text.replace("$3A09", "$3A0A"), bytes: rom.bytes, defines: [], reader: noIncludes, decodeAt: rom.decodeAt });
    expect(wrong.stop?.reason).toMatch(/byte 1/);
  });

  it("expands a macro: arguments, its own labels, a string argument inside quotes", () => {
    const text = ['        include "macros.def"', "        org $C000", '        dt_nam  "AB"'].join("\n");
    // --- $10, the length to the end (4: "AB", 0 and itself), "AB", 0
    const rom = bank([0x10, 0x04, 0x41, 0x42, 0x00], {});
    const result = alignOzModule({ path: "m.asm", text, bytes: rom.bytes, defines: [], reader, decodeAt: rom.decodeAt });
    expect(result.stop).toBeUndefined();
    expect(result.end).toBe(5);
    expect(result.labels.every((l) => l.internal)).toBe(true);
  });

  it("stops at a macro's error", () => {
    const text = ['        include "macros.def"', "        org $C000", "        dt_nam"].join("\n");
    const rom = bank([], {});
    const result = alignOzModule({ path: "m.asm", text, bytes: rom.bytes, defines: [], reader, decodeAt: rom.decodeAt });
    expect(result.stop?.reason).toMatch(/dt_nam macro's error/);
  });

  it("reads defgroup's consecutive values", () => {
    const text = ["defgroup", "    a_zero, a_one", "    b_ten = 10, b_eleven", "enddef", "        org $C000", "        defb b_eleven"].join("\n");
    const rom = bank([11], {});
    const result = alignOzModule({ path: "m.asm", text, bytes: rom.bytes, defines: [], reader: noIncludes, decodeAt: rom.decodeAt });
    expect(result.stop).toBeUndefined();
    expect(result.end).toBe(1);
  });
});

describe("shortLabelName", () => {
  it("keeps a name that fits, and shortens one that does not to 16 characters", () => {
    expect(shortLabelName("FPAdd")).toBe("FPAdd");
    for (const name of ["could_not_open_file_quit_to_main", "GetDefaultListingFilename", "ValidateNewCursorOffset"]) {
      const short = shortLabelName(name);
      expect(short.length, name).toBeLessThanOrEqual(16);
      expect(short, name).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
    }
  });

  it("abbreviates common words first, keeping their case", () => {
    expect(shortLabelName("DisplayEazyLinkVersion")).toMatch(/^DispEazyLink/);
    expect(shortLabelName("TransferFileBlock")).toBe("XferFileBlk");
  });

  it("is deterministic and gives a taken name a number", () => {
    expect(shortLabelName("ozFileEprTotalSpace")).toBe(shortLabelName("ozFileEprTotalSpace"));
    const first = shortLabelName("ozFileEprTotalSpace");
    expect(shortLabelName("ozFileEprTotalSpace", new Set([first]))).not.toBe(first);
  });
});

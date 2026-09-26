import { describe, expect, it } from "vitest";

import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { runFrontEnd } from "@main/kbasic/KBasicCompiler";
import { defaultOptions, type KBasicOptions } from "@main/kbasic/options/options";
import { runtimeBundle } from "@main/kbasic/runtime/generated/runtime-bundle";

import { compileBasic, runBasic } from "./run-kit";

/** Klive BASIC's standard library (plan §6.4): `#include <name.bas>`, run on the 48K. */
describe("standard library", () => {
  const front = (source: string, options: Partial<KBasicOptions> = {}) => {
    const diagnostics = new DiagnosticBag();
    const result = runFrontEnd("/test/main.bas", source, { read: () => undefined }, { ...defaultOptions(), ...options }, diagnostics);
    return { result, diagnostics };
  };

  describe("string.bas", () => {
    const source = [
      "#include <string.bas>",
      'DIM s AS String = "Spectrum"',
      'PRINT left(s, 4); "|"; right(s, 3); "|"; mid(s, 2, 3); "|"; mid(s, 6, 9); "|"; mid(s, 9, 2); "|"; left(s, 20)',
      'PRINT LEFT(s, 0); "|"; Right$(s, 1)',
      ""
    ].join("\n");

    it("slices from the start, the end and the middle (strings count from 0)", async () => {
      const r = await runBasic(source);
      expect(r.screen(2)).toEqual(["Spec|rum|ect|um||Spectrum", "|m"]);
    });

    it("counts positions from 1 under string-base 1", async () => {
      const r = await runBasic(source, { stringBase: 1 });
      expect(r.screen(2)[0]).toBe("Spec|rum|pec|rum||Spectrum");
    });
  });

  it("hex.bas gives 8, 4 and 2 upper-case digits", async () => {
    const r = await runBasic('#include <hex.bas>\nPRINT hex(3735928559); " "; hex16(4660); " "; hex8(10); " "; HEX(0)\n');
    expect(r.screen(1)[0]).toBe("DEADBEEF 1234 0A 00000000");
  });

  it("asc.bas reads a character's code, 0 past the end", async () => {
    const r = await runBasic('#include <asc.bas>\nPRINT asc("AB", 1); " "; asc("AB", 2); " "; ASC("AB", 0)\n');
    expect(r.screen(1)[0]).toBe("66 0 65");
  });

  it("pos.bas and csrlin.bas read the PRINT cursor", async () => {
    const source = [
      "#include <pos.bas>",
      "#include <csrlin.bas>",
      "DIM c, r AS UByte",
      'PRINT AT 5, 7; "ab";',
      "c = POS()",
      "r = CSRLIN()",
      "PRINT AT 0, 0; r; \" \"; c",
      ""
    ].join("\n");
    expect((await runBasic(source)).screen(1)[0]).toBe("5 9");
  });

  it("attr.bas reads a cell's attribute on any of the 24 rows", async () => {
    const source = '#include <attr.bas>\nPRINT AT 23, 4; INK 2; PAPER 5; "X";\nPRINT AT 0, 0; ATTR(23, 4); " "; attr(0, 31)\n';
    expect((await runBasic(source)).screen(1)[0]).toBe(`42 ${0x38}`);
  });

  it("point.bas tests a pixel, (0, 0) at the bottom left", async () => {
    // --- (255, 191) is the top right: the PRINT on row 0 does not reach it
    const source = "#include <point.bas>\nPLOT 10, 20\nPLOT 255, 191\nPRINT POINT(10, 20); POINT(11, 20); POINT(10, 21); POINT(255, 191); POINT(255, 192)\n";
    expect((await runBasic(source)).screen(1)[0].slice(0, 5)).toBe("10010");
  });

  it("screen.bas recognises the font's characters, normal and inverse", async () => {
    const source = [
      "#include <screen.bas>",
      'PRINT AT 2, 3; "Q"; INVERSE 1; "r"; INVERSE 0; CHR$(144)',
      'PRINT AT 0, 0; SCREEN$(2, 3); SCREEN$(2, 4); "|"; SCREEN$(2, 5); "|"; LEN(SCREEN$(2, 6)); "|"; LEN(SCREEN$(24, 0))',
      ""
    ].join("\n");
    // --- The UDG (column 5) is not in the font; an empty cell (column 6) is a space
    const r = await runBasic(source, { before: (s) => s.poke(0xff58, [0x18, 0x3c, 0x7e, 0xff, 0xff, 0x7e, 0x3c, 0x18]) });
    expect(r.screen(1)[0]).toBe("Qr||1|0");
  });

  describe("keys.bas", () => {
    it("has a scan code for every key", () => {
      const text = runtimeBundle.stdlib.find((f) => f.name === "keys.bas")!.text;
      const names = [...text.matchAll(/^CONST (KEY\w+) AS UInteger = 0([0-9A-F]{4})h$/gm)].map((m) => [m[1], Number.parseInt(m[2], 16)] as const);
      expect(names.length).toBe(40);
      const codes = new Map(names);
      expect(codes.get("KEYH")).toBe(0xbf10);
      expect(codes.get("KEYSPACE")).toBe(0x7f01);
      expect(new Set(names.map(([, v]) => v)).size).toBe(40);
    });

    it("reads the keys held down without the ROM", async () => {
      const source = [
        "#include <keys.bas>",
        "PRINT GetKeyScanCode(); \" \"; MultiKeys(KEYH BOR KEYJ); \" \"; MultiKeys(KEYJ); \" \"; MultiKeys(KEYSPACE)",
        "PRINT CHR$(GetKey())",
        ""
      ].join("\n");
      // --- GetKey gives what INKEY$ reads: of two keys down, the runtime's scan finds J first
      const r = await runBasic(source, { before: (s) => s.keyDown("H", "J") });
      expect(r.screen(2)).toEqual([`${0xbf18} 24 8 0`, "j"]);
    });

    it("gives 0 when no key is down", async () => {
      expect((await runBasic("#include <keys.bas>\nPRINT GetKeyScanCode()\n")).screen(1)[0]).toBe("0");
    });
  });

  it("input.bas reads a line, with DELETE, until ENTER", async () => {
    const source = '#include <input.bas>\nDIM s AS String\nPRINT "> ";\ns = INPUT(5)\nPRINT AT 2, 0; "["; s; "]"\n';
    const r = await runBasic(source, { expectEnd: false, frames: 5 });
    // --- Keys go down one frame apart, as fingers press them (CAPS SHIFT first)
    const type = (...keys: string[]) => {
      for (const k of keys) r.session.keyDown(k).runFrames(1);
      r.session.runFrames(2);
      r.session.keyUp(...keys).runFrames(3);
    };
    for (const k of ["A", "B", "C"]) type(k);
    type("CShift", "N0"); // DELETE
    for (const k of ["D", "E", "F", "G", "H"]) type(k); // only five fit
    type("Enter");
    r.session.runFrames(5);
    expect(r.screen(3)).toEqual(["> abdef", "", "[abdef]"]);
  });

  describe("putchars.bas", () => {
    it("putChars copies bitmaps column by column", async () => {
      const source = [
        "#include <putchars.bas>",
        "DIM i AS UInteger",
        "FOR i = 0 TO 31: POKE 40000 + i, i + 1: NEXT i",
        "putChars(3, 9, 2, 2, 40000)",
        ""
      ].join("\n");
      const r = await runBasic(source);
      const cell = (row: number, col: number) =>
        Array.from({ length: 8 }, (_, line) => r.session.peek(0x4000 + ((row & 0x18) << 8) + ((row & 7) << 5) + col + (line << 8)));
      expect(cell(9, 3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(cell(10, 3)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
      expect(cell(9, 4)).toEqual([17, 18, 19, 20, 21, 22, 23, 24]);
      expect(cell(10, 4)).toEqual([25, 26, 27, 28, 29, 30, 31, 32]);
    });

    it("paint fills attributes and paintData copies them row by row", async () => {
      const source = [
        "#include <putchars.bas>",
        "POKE 40000, 1: POKE 40001, 2: POKE 40002, 3: POKE 40003, 4",
        "paint(1, 1, 3, 2, 71)",
        "paintData(10, 20, 2, 2, 40000)",
        ""
      ].join("\n");
      const r = await runBasic(source);
      const attr = (row: number, col: number) => r.session.peek(0x5800 + row * 32 + col);
      expect([attr(1, 1), attr(1, 3), attr(2, 1), attr(2, 3), attr(1, 4), attr(3, 1)]).toEqual([71, 71, 71, 71, 0x38, 0x38]);
      expect([attr(20, 10), attr(20, 11), attr(21, 10), attr(21, 11)]).toEqual([1, 2, 3, 4]);
    });
  });

  describe("print42.bas and print64.bas", () => {
    // --- The screen byte of a character cell's pixel row
    const at = (row: number, byte: number, line: number) => 0x4000 + ((row & 0x18) << 8) + ((row & 7) << 5) + (line << 8) + byte;

    it("print42 squeezes the ROM font to 6 pixels a character, in the permanent colours", async () => {
      const source = '#include <print42.bas>\nPAPER 1\nprintat42(2, 0)\nprint42("AMA")\nprint42(CHR$(13) + "x")\n';
      const r = await runBasic(source);
      const font = (code: number, line: number) => r.session.peek(0x3d00 + (code - 32) * 8 + line);
      const squeeze = (g: number) => ((g & 0x70) << 1) | ((g & 0x0e) << 2);
      for (let line = 0; line < 8; line++) {
        // --- A at pixels 0-5, M at 6-11, A at 12-17
        const bits = (squeeze(font(65, line)) << 16) | (squeeze(font(77, line)) << 10) | (squeeze(font(65, line)) << 4);
        expect([r.session.peek(at(2, 0, line)), r.session.peek(at(2, 1, line)), r.session.peek(at(2, 2, line))]).toEqual([
          (bits >> 16) & 0xff,
          (bits >> 8) & 0xff,
          bits & 0xff
        ]);
        expect(r.session.peek(at(3, 0, line))).toBe(squeeze(font(120, line)));
      }
      expect([r.session.peek(0x5800 + 64), r.session.peek(0x5800 + 66), r.session.peek(0x5800 + 67)]).toEqual([0x08, 0x08, 0x38]);
    });

    it("print64 prints Klive's 4-pixel font at its own cursor", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const font64 = require("../../../scripts/kbasic-font64.cjs");
      const bytes: number[] = font64.pack();
      const glyph = (code: number, line: number) => {
        const b = bytes[((code - 32) >> 1) * 8 + line];
        return code & 1 ? (b << 4) & 0xf0 : b & 0xf0;
      };
      const r = await runBasic('#include <print64.bas>\nprintat64(5, 3)\nprint64("Hi!")\nPRINT AT 0, 0; "ok"\n');
      for (let line = 0; line < 8; line++) {
        // --- Column 3 is byte 1's low nibble; columns 4 and 5 share byte 2
        expect(r.session.peek(at(5, 1, line)) & 0x0f).toBe(glyph(72, line) >> 4);
        expect(r.session.peek(at(5, 2, line))).toBe(glyph(105, line) | (glyph(33, line) >> 4));
      }
      expect(r.screen(1)[0]).toBe("ok");
    });

    it("the 64-column font table is the one scripts/kbasic-font64.cjs designs", () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const font64 = require("../../../scripts/kbasic-font64.cjs");
      const text = runtimeBundle.stdlib.find((f) => f.name === "print64.bas")!.text;
      expect(text).toContain(font64.table(font64.pack()));
    });

    it("printat42 and printat64 stop with 5 Out of screen past the edge", async () => {
      for (const call of ["#include <print64.bas>\nprintat64(24, 0)\n", "#include <print42.bas>\nprintat42(0, 42)\n"]) {
        const r = await runBasic(call, { expectEnd: false, frames: 60 });
        expect(r.session.screenLine(23)).toMatch(/^5 Out of screen/);
      }
    });
  });

  describe("DRAW with an arc (__drawarc.bas)", () => {
    it("ends on the target, turning left (anticlockwise) for a positive angle", async () => {
      const source = [
        "#include <point.bas>",
        "DIM y, low, high AS UByte",
        "PLOT 100, 100",
        "DRAW 50, 0, PI",
        "PRINT PEEK 23677; \",\"; PEEK 23678",
        "FOR y = 0 TO 99",
        "  IF POINT(125, y) THEN low = y",
        "NEXT y",
        "PLOT 100, 140",
        "DRAW 50, 0, -PI / 2",
        "FOR y = 141 TO 191",
        "  IF POINT(125, y) THEN high = y",
        "NEXT y",
        "PRINT low; \",\"; high",
        ""
      ].join("\n");
      const r = await runBasic(source, { frames: 1500 });
      // --- Heading east and turning left through PI, the half circle (radius 25) passes below the
      // --- chord, down to y = 75; a quarter turn right rises above its chord by
      // --- 25 * (1 - cos 45) / sin 45 = 10.4 pixels
      const [end, extremes] = r.screen(2);
      expect(end).toBe("150,100");
      const [low, high] = extremes.split(",").map(Number);
      expect(Math.abs(low - 75)).toBeLessThanOrEqual(1);
      expect(Math.abs(high - 150)).toBeLessThanOrEqual(1);
    });

    it("draws a straight line for an angle of 0 and takes temporary colours", async () => {
      const source = "PLOT 0, 0\nDRAW INK 2; 40, 40, 0\nPRINT AT 0, 0; PEEK 23677; \",\"; PEEK 23678\n";
      const r = await runBasic(source);
      expect(r.screen(1)[0]).toBe("40,40");
      // --- The cell with pixel (20, 20) has INK 2; the permanent colours are back afterwards
      expect(r.session.peek(0x5800 + (23 - 2) * 32 + 2) & 7).toBe(2);
      expect(r.session.peek(0x5800) & 7).toBe(0);
    });

    it("is included only when the program uses DRAW", () => {
      const names = (source: string) => front(source).result.sources.files.map((f) => f.name);
      expect(names("PLOT 1, 1\n").some((n) => n.includes("__drawarc"))).toBe(false);
      expect(names("DRAW 1, 1\n").some((n) => n.includes("__drawarc"))).toBe(true);
    });
  });

  describe("the library as the compiler uses it", () => {
    it("sinclair-compatible brings ATTR, POINT and SCREEN$ without an #include", async () => {
      const r = await runBasic('PLOT 1, 1\nPRINT AT 0, 0; "Z"; ATTR(0, 0); POINT(1, 1); SCREEN$(0, 0)\n', { sinclairCompatible: true });
      expect(r.screen(1)[0]).toBe(`Z${0x38}1Z`);
    });

    it("names a documented library that is not written yet (E216)", () => {
      const { diagnostics } = front("#include <zx0.bas>\n");
      const e216 = diagnostics.items.filter((d) => d.code === "E216");
      expect(e216.map((d) => d.message)).toEqual(["<zx0.bas> is not available in Klive BASIC yet"]);
      const other = front("#include <nowhere.bas>\n").diagnostics.items.filter((d) => d.code === "E216");
      expect(other[0].message).toMatch(/not in Klive BASIC's library, nor in the include path/);
    });

    it("prefers the library to a file of the same name in the include path", () => {
      const { result, diagnostics } = front("#include <hex.bas>\nPRINT hex8(1)\n");
      expect(diagnostics.hasErrors).toBe(false);
      expect(result.sources.files.some((f) => f.name === "<kbasic-stdlib>/hex.bas")).toBe(true);
    });

    it("reports no warnings about library code and leaves unused routines out", async () => {
      const source = "#include <string.bas>\n#include <putchars.bas>\n#include <keys.bas>\nPRINT left(\"ab\", 1)\n";
      const { generated, diagnostics } = await compileBasic(source);
      expect(diagnostics.items.filter((d) => d.severity !== "error")).toEqual([]);
      const labels = generated.mir.functions.map((f) => f.label);
      expect(labels).toContain("_left");
      expect(labels).not.toContain("_right");
      expect(labels).not.toContain("_putChars");
      // --- Library statements are not the user's: the IDE's tables name only /test/main.bas
      expect(generated.debug.classic.sourceFileList.map((f) => f.filename)).toEqual(["/test/main.bas"]);
      expect(generated.debug.problems).toEqual([]);
    });

    it("finds library names in any case, even in a case-sensitive program", () => {
      const { diagnostics } = front('#include <string.bas>\nPRINT LEFT("ab", 1); Left$("ab", 1); mid("ab", 0, 1)\n');
      expect(diagnostics.items.filter((d) => d.severity === "error")).toEqual([]);
    });

    it("every library file compiles on its own", async () => {
      for (const file of runtimeBundle.stdlib) {
        const { diagnostics } = front(`#include <${file.name}>\n`);
        expect(diagnostics.items.filter((d) => d.severity === "error"), file.name).toEqual([]);
      }
    });
  });
});

import { describe, expect, it } from "vitest";

import { mirText } from "@main/kbasic/emit-files";
import type { MFunction } from "@main/kbasic/ir/mir";
import { MIR_PASSES, optimizeMir } from "@main/kbasic/opt/mir-passes";

import { compileBasic } from "../codegen/run-kit";

/**
 * Level 1 (`.docs/kbasic-optimiser.md` §2–§4): the per-statement MIR passes and the tree selector's
 * code shapes. The corpus checks that level 1 behaves as level 0 (`integers/level1-shapes.zxbas` is
 * written for these shapes); this pins what the code looks like.
 */
const code = async (source: string) => {
  const { generated } = await compileBasic(source, { optimize: 1 });
  const text = generated.emitted.text.split("\n");
  const main = text.slice(text.indexOf("_main:") + 1);
  return main.slice(0, main.findIndex((l) => /^\s+jp core\.End/.test(l))).filter((l) => !l.startsWith(";")).map((l) => l.trim());
};

describe("MIR passes", () => {
  it("drop identities and fold x * 0 when x has no effect", async () => {
    const { generated } = await compileBasic("DIM y, x AS UInteger\nx = y + 0\nx = y * 1\nx = y * 0\n", { optimize: 1 });
    const mir = mirText(generated.mir);
    expect(mir).not.toMatch(/ add | mul /);
    expect(mir.match(/load \[_y\]/g)?.length).toBe(2);
  });

  it("keep a call whose result is multiplied by zero", async () => {
    const { generated } = await compileBasic("FUNCTION f(n AS UInteger) AS UInteger\n RETURN n\nEND FUNCTION\nDIM x AS UInteger\nx = f(1) * 0\n", { optimize: 1 });
    expect(mirText(generated.mir)).toMatch(/call\.stdcall _f/);
  });

  it("fold constant operands into the same vreg, then drop the constants", () => {
    const fn: MFunction = {
      label: "_main",
      name: "main",
      kind: "main",
      convention: "stdcall",
      params: [],
      locals: [],
      frameSize: 0,
      argBytes: 0,
      blocks: [
        {
          label: "_main",
          instrs: [
            { op: "stmt", sid: 0 },
            { op: "const", dst: { kind: "vreg", id: 1, type: "u8" }, value: { kind: "imm", type: "u8", value: 200 }, sid: 0 },
            { op: "const", dst: { kind: "vreg", id: 2, type: "u8" }, value: { kind: "imm", type: "u8", value: 100 }, sid: 0 },
            { op: "bin", bop: "add", dst: { kind: "vreg", id: 3, type: "u8" }, a: { kind: "vreg", id: 1, type: "u8" }, b: { kind: "vreg", id: 2, type: "u8" }, sid: 0 },
            { op: "store", type: "u8", slot: { kind: "global", name: "_x" }, src: { kind: "vreg", id: 3, type: "u8" }, sid: 0 }
          ],
          term: { op: "ret", sid: -1 }
        }
      ]
    };
    const applied: string[] = [];
    optimizeMir({ functions: [fn], data: [], statements: [], runtime: new Set() }, 1, (p) => applied.push(p));
    expect(applied).toEqual(expect.arrayContaining(["fold", "dead-code"]));
    expect(fn.blocks[0].instrs.map((i) => i.op)).toEqual(["stmt", "const", "store"]);
    expect(fn.blocks[0].instrs[1]).toMatchObject({ dst: { id: 3 }, value: { value: 44 } });
    expect(MIR_PASSES.map((p) => p.name)).toEqual(["fold", "algebra", "branch-fold", "dead-code"]);
  });
});

describe("the tree selector", () => {
  it("uses leaves where they are and branches on the flags", async () => {
    const lines = await code("DIM a, b AS UByte\nIF a < 10 THEN b = 1\nIF a = b THEN b = 2\n");
    expect(lines.slice(0, 3)).toEqual(["ld a,(_a)", "cp 10", expect.stringMatching(/^jr nc,__b\d+$/)]);
    expect(lines).toContain("cp (hl)");
    expect(lines.join(" ")).not.toMatch(/push|pop/);
  });

  it("multiplies and divides by constants without the runtime", async () => {
    const lines = await code("DIM u, r AS UInteger\nr = u * 10\nr = u / 16\nr = u MOD 256\n");
    expect(lines.join(" ")).not.toMatch(/Mul16|DivMod/);
    expect(lines).toEqual(expect.arrayContaining(["add hl,de", "srl h", "rr l"]));
  });

  it("indexes an array with a shift and stores through the pointer", async () => {
    const lines = await code("DIM t(9) AS UInteger\nDIM i AS UByte\nt(i) = 500\n");
    expect(lines).toEqual(["ld a,(_i)", "ld l,a", "ld h,0", "add hl,hl", "ld de,_t.data", "add hl,de", "ld de,500", "ld (hl),e", "inc hl", "ld (hl),d", "ld bc,0"]);
  });

  it("leaves what it does not handle to level 0, statement by statement", async () => {
    const lines = await code('DIM s AS String\nDIM a AS UByte\ns = "x"\na = a + 1\n');
    expect(lines).toContain("call core.StrStore");
    expect(lines.slice(-4)).toEqual(["ld a,(_a)", "inc a", "ld (_a),a", "ld bc,0"]);
  });
});

describe("level 2: constant slots", () => {
  it("compares a FOR loop with its constant limit: the limit is evaluated at each test (ZX BASIC)", async () => {
    for (const level of [1, 2]) {
      const { generated } = await compileBasic("DIM i AS UByte\nFOR i = 0 TO 9\n POKE 16384 + i, i\nNEXT i\n", { optimize: level });
      const text = generated.emitted.text;
      expect(text).not.toMatch(/__forlim/);
      expect(text).toMatch(/^\s+cp 10$/m);
    }
  });

  it("keeps a user variable's store, and a load the store does not dominate", async () => {
    const source = "SUB s()\n DIM k, n AS UByte\n WHILE n < 3\n  POKE 16384 + n, k\n  k = 5\n  n = n + 1\n WEND\nEND SUB\ns()\n";
    const { generated } = await compileBasic(source, { optimize: 2 });
    const text = generated.emitted.text;
    // --- k's store stays, and the POKE before it still reads k's slot
    expect(text).toMatch(/ld \(ix-1\),5/);
    expect(text).toMatch(/ld a,\(ix-1\)/);
  });
});

describe("branch folding", () => {
  it("turns a branch on a constant into a jump", async () => {
    const source = "DIM a AS UByte\nWHILE 1\n a = a + 1\n IF a = 10 THEN EXIT WHILE\nWEND\nPRINT a\n";
    const mir = (level: number) => compileBasic(source, { optimize: level }).then((c) => mirText(c.generated.mir));
    expect((await mir(0)).match(/^\s+br /gm)?.length).toBe(2);
    expect((await mir(1)).match(/^\s+br /gm)?.length).toBe(1);
  });
});

describe("level 2: unused routines", () => {
  const source = [
    "SUB used()",
    " POKE 16384, 1",
    "END SUB",
    "SUB unused()",
    " PRINT \"never\"",
    "END SUB",
    "FUNCTION byAddress() AS UByte",
    " RETURN 1",
    "END FUNCTION",
    "SUB byAsm()",
    " POKE 16385, 2",
    "END SUB",
    "SUB onlyFromUnused()",
    " POKE 16386, 3",
    "END SUB",
    "used()",
    "DIM p AS UInteger",
    "p = @byAddress",
    "ASM",
    " call _byAsm",
    "END ASM",
    ""
  ].join("\n");

  it("get no code, while routines reached by a call, an address or inline asm stay", async () => {
    const { generated } = await compileBasic(source, { optimize: 2 });
    const text = generated.emitted.text;
    expect(text).toMatch(/^_used:/m);
    expect(text).toMatch(/^_byAddress:/m);
    expect(text).toMatch(/^_byAsm:/m);
    expect(text).not.toMatch(/^_unused:/m);
    expect(generated.debug.problems).toEqual([]);
    expect(generated.debug.sourceLevel.callables.map((c) => c.name)).not.toContain("unused");
    const level1 = (await compileBasic(source, { optimize: 1 })).generated.emitted.text;
    expect(level1).toMatch(/^_unused:/m);
  });
});

describe("level 3: inlining", () => {
  it("puts a small leaf routine with one call site into its caller, and keeps the rest", async () => {
    const source = [
      "FUNCTION once(n AS UByte) AS UByte",
      " RETURN n + 1",
      "END FUNCTION",
      "FUNCTION twice(n AS UByte) AS UByte",
      " RETURN n * 2",
      "END FUNCTION",
      "DIM a AS UByte",
      "a = once(1) + twice(2) + twice(3)",
      ""
    ].join("\n");
    const { generated } = await compileBasic(source, { optimize: 3 });
    const text = generated.emitted.text;
    expect(text).not.toMatch(/^_once:/m);
    expect(text).toMatch(/^_twice:/m);
    expect(generated.debug.problems).toEqual([]);
    // --- The inlined statement belongs to the main program now, and says where it came from
    const once = generated.mir.functions.findIndex((f) => f.name === "once");
    const moved = generated.mir.statements.filter((s) => s.inlinedFrom === once);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.every((s) => generated.mir.functions[s.functionIndex].kind === "main")).toBe(true);
    expect(generated.debug.sourceLevel.callables.map((c) => c.name)).not.toContain("once");
  });
});

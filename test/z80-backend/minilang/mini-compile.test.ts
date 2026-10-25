import { describe, expect, it } from "vitest";

import { problemMessage } from "@main/z80-backend/problems";

import { compileMini, lowerMini } from "./mini";

/**
 * The "mini" language on the shared back end, compiled only (`mini-run.test.ts` runs it on the 48K):
 * a front end that knows nothing of Klive BASIC gets a program, its debug tables and its problems
 * from the back end.
 */
const PROGRAM = ["var total", "proc show(n)", "  print n * 2", "end", "total = 7 / 2", "while total > 0 do", "  call show(total)", "  total = total - 1", "end", ""].join("\n");

describe("the mini language on the shared back end", () => {
  it("lowers to MIR with its own meanings stated", () => {
    const mir = lowerMini(PROGRAM);
    expect(mir.functions.map((f) => [f.name, f.kind])).toEqual([
      ["main", "entry"],
      ["show", "routine"]
    ]);
    const ops = mir.functions.flatMap((f) => f.blocks.flatMap((b) => b.instrs)).filter((i) => i.op === "bin");
    expect(ops.find((i) => i.op === "bin" && i.bop === "div")).toMatchObject({ rounding: "trunc" });
    expect(ops.find((i) => i.op === "bin" && i.bop === "mul")).toMatchObject({ overflow: "wrap" });
  });

  it("compiles at every level, linking only the back end's packages", async () => {
    for (const optimize of [0, 1, 2, 3]) {
      const result = await compileMini(PROGRAM, { optimize });
      if (!result.ok) throw new Error(result.problems.map(problemMessage).join("; "));
      const files = result.compiled.output.sourceFileList.map((f) => f.filename);
      expect(files.some((f) => f.endsWith("print.kz80.asm")), `level ${optimize}`).toBe(true);
      // --- No module of Klive BASIC's own package
      expect(files.some((f) => /\/(strings|arrays|data|usr)\.kz80\.asm$/.test(f)), `level ${optimize}`).toBe(false);
    }
  });

  it("gets the debugger's tables in its own language's name", async () => {
    const result = await compileMini(PROGRAM);
    if (!result.ok) throw new Error("did not compile");
    const sld = result.compiled.debug.sourceLevel;
    expect(sld.language).toBe("mini");
    expect(sld.callables.map((c) => [c.name, c.kind])).toEqual([
      ["main", "entrypoint"],
      ["show", "subroutine"]
    ]);
    expect(sld.statements.map((s) => s.startLine)).toEqual(expect.arrayContaining([3, 4, 5, 6, 7, 8]));
    expect(sld.extensions!.variables.map((v) => [v.name, v.type, v.typeLabel, v.kind])).toEqual([
      ["total", "i16", "int", "global"],
      ["n", "i16", "int", "parameter"]
    ]);
    expect(sld.extensions!.callSites).toEqual([expect.objectContaining({ kind: "routine", calleeIndex: 1 })]);
    // --- mini has no error stop and no source labels: the back end adds none
    expect(sld.extensions!.errorStop).toBeUndefined();
    expect(sld.extensions!.labels).toEqual([]);
  });

  it("reports a meaning the back end does not implement in its own words", async () => {
    const mir = lowerMini("var x\nx = 7 / 2\n");
    const div = mir.functions[0].blocks.flatMap((b) => b.instrs).find((i) => i.op === "bin" && i.bop === "div")!;
    (div as { rounding?: string }).rounding = "floor";
    const { compileModule } = await import("@main/z80-backend/link/compile-module");
    const { MINI_OPTIONS, MiniSource } = await import("./mini");
    const source = new MiniSource("main.mini", "var x\nx = 7 / 2\n");
    const result = await compileModule(mir, MINI_OPTIONS, {
      language: "mini",
      packages: [],
      sources: { get: () => source },
      isLibraryFile: () => false,
      isLibraryFileName: () => false,
      programName: "main",
      programFile: "main.mini.asm"
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(problemMessage(result.problems[0])).toMatch(/intermediate code is invalid .*rounding 'floor'/);
  });
});

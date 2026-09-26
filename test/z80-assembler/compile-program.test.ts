import { describe, it, expect } from "vitest";
import path from "path";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { ExpressionValue } from "@main/compiler-common/expressions";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

const RUNTIME = [
  "  .module core",
  "Double:",
  "  add a,a",
  "  ret",
  "  .moduleend"
].join("\n");

const MAIN = ["  .org $8000", "Main:", "  ld a,3", "  call core.Double", "  ret"].join("\n");

async function unit(filename: string, text: string, options?: AssemblerOptions) {
  return await new Z80Assembler().parseSourceUnit(filename, text, options);
}

describe("Assembler - compileProgram", () => {
  it("a single unit assembles like compile()", async () => {
    const source = `${MAIN}\n${RUNTIME}`;
    const direct = await new Z80Assembler().compile(source);
    const program = await new Z80Assembler().compileProgram([await unit("#", source)]);

    expect(program.errorCount).toBe(0);
    expect(program.segments.map((s) => s.emittedCode)).toEqual(direct.segments.map((s) => s.emittedCode));
    expect(program.listFileItems).toEqual(direct.listFileItems);
    expect(program.sourceMap).toEqual(direct.sourceMap);
  });

  it("links units in order and resolves symbols across them", async () => {
    const output = await new Z80Assembler().compileProgram([
      await unit("main.kbasic.asm", MAIN),
      await unit("core.kz80.asm", RUNTIME)
    ]);

    expect(output.errorCount).toBe(0);
    expect(output.segments[0].emittedCode).toEqual([0x3e, 0x03, 0xcd, 0x06, 0x80, 0xc9, 0x87, 0xc9]);
    expect(output.sourceFileList.map((f) => f.filename)).toEqual(["main.kbasic.asm", "core.kz80.asm"]);
    expect(output.sourceItem.filename).toBe("main.kbasic.asm");

    const addItem = output.listFileItems.find((i) => i.address === 0x8006);
    expect(addItem).toMatchObject({ fileIndex: 1, lineNumber: 3 });
    expect(output.sourceMap[0x8006]).toMatchObject({ fileIndex: 1, line: 3 });
    expect(output.sourceMap[0x8002]).toMatchObject({ fileIndex: 0, line: 4 });
  });

  it("shifts file indexes past the files a unit includes", async () => {
    const includer = path.join(__dirname, "../testfiles/SingleInclude.z80asm");
    const mainUnit = await unit(includer, "  .org $8000\n  nop\n#include \"./inc1.z80asm\"\n");
    expect(mainUnit.files.map((f) => path.basename(f.filename))).toEqual([
      "SingleInclude.z80asm",
      "inc1.z80asm"
    ]);

    const output = await new Z80Assembler().compileProgram([mainUnit, await unit("core.kz80.asm", RUNTIME)]);

    expect(output.errorCount).toBe(0);
    expect(output.sourceFileList.map((f) => path.basename(f.filename))).toEqual([
      "SingleInclude.z80asm",
      "inc1.z80asm",
      "core.kz80.asm"
    ]);
    expect(output.sourceMap[0x8001]).toMatchObject({ fileIndex: 1, line: 1 });
    expect(output.sourceMap[0x8002]).toMatchObject({ fileIndex: 2, line: 3 });
  });

  it("reuses a parsed unit across programs without changing it", async () => {
    const runtime = await unit("core.kz80.asm", RUNTIME);
    const linesBefore = JSON.stringify(runtime.lines);

    const first = await new Z80Assembler().compileProgram([await unit("a.asm", MAIN), runtime]);
    const second = await new Z80Assembler().compileProgram([
      await unit("b.asm", "  .org $9000\n  nop\n"),
      await unit("c.asm", "Main:\n  ld a,5\n  call core.Double\n  ret\n"),
      runtime
    ]);

    expect(first.errorCount).toBe(0);
    expect(second.errorCount).toBe(0);
    expect(second.segments[0].emittedCode).toEqual([0x00, 0x3e, 0x05, 0xcd, 0x07, 0x90, 0xc9, 0x87, 0xc9]);
    expect(first.sourceMap[0x8006]).toMatchObject({ fileIndex: 1 });
    expect(second.sourceMap[0x9007]).toMatchObject({ fileIndex: 2 });
    expect(JSON.stringify(runtime.lines)).toBe(linesBefore);
  });

  it("applies a unit's .model pragma", async () => {
    const nextCode = "  .org $8000\n  mul d,e\n";
    const without = await new Z80Assembler().compileProgram([await unit("a.asm", nextCode)]);
    expect(without.errors.map((e) => e.errorCode)).toContain("Z0414");

    const withModel = await new Z80Assembler().compileProgram([
      await unit("a.asm", `  .model next\n${nextCode}`)
    ]);
    expect(withModel.errorCount).toBe(0);
    expect(withModel.modelType).toBe(4);
    expect(withModel.segments[0].emittedCode).toEqual([0xed, 0x30]);
  });

  it("reports a second .model in another unit", async () => {
    const output = await new Z80Assembler().compileProgram([
      await unit("a.asm", "  .model next\n  nop\n"),
      await unit("b.asm", "  .model Spectrum48\n  nop\n")
    ]);
    const error = output.errors.find((e) => e.errorCode === "Z0302");
    expect(error).toMatchObject({ filename: "b.asm", line: 1 });
  });

  it("keeps a unit's parse errors and fails the build", async () => {
    const output = await new Z80Assembler().compileProgram([
      await unit("a.asm", MAIN),
      await unit("bad.asm", "  .module core\nDouble:\n  ld a,\n  .moduleend\n")
    ]);
    expect(output.errorCount).toBeGreaterThan(0);
    expect(output.errors[0].filename).toBe("bad.asm");
    expect(output.segments.length).toBe(0);
  });

  it("reports assembly errors in the unit's file", async () => {
    const output = await new Z80Assembler().compileProgram([
      await unit("a.asm", MAIN),
      await unit("core.kz80.asm", "  .module core\nDouble:\n  jp Missing\n  .moduleend\n")
    ]);
    expect(output.errors[0]).toMatchObject({ filename: "core.kz80.asm", line: 3 });
  });

  it("bakes preprocessing into the unit when it is parsed", async () => {
    const text = "  .org $8000\n#ifdef FAST\n  nop\n#else\n  halt\n#endif\n";
    const options = new AssemblerOptions();
    options.predefinedSymbols = { FAST: new ExpressionValue(true) };
    const fast = await unit("a.asm", text, options);
    const slow = await unit("a.asm", text);

    expect((await new Z80Assembler().compileProgram([fast])).segments[0].emittedCode).toEqual([0x00]);
    expect((await new Z80Assembler().compileProgram([slow])).segments[0].emittedCode).toEqual([0x76]);
  });

  it("rejects an empty program", async () => {
    await expect(new Z80Assembler().compileProgram([])).rejects.toThrow();
  });
});

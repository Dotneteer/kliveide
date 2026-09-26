import { describe, it, expect } from "vitest";
import path from "path";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

async function compile(source: string, filename?: string) {
  const assembler = new Z80Assembler();
  if (!filename) return await assembler.compile(source);
  return await assembler.compileProgram([await assembler.parseSourceUnit(filename, source)]);
}

describe("Assembler - #line directive", () => {
  it("renumbers the lines that follow it", async () => {
    const output = await compile(["  .org $8000", "  nop", "#line 100", "  nop", "  nop"].join("\n"));

    expect(output.errorCount).toBe(0);
    expect(output.sourceMap[0x8000]).toMatchObject({ fileIndex: 0, line: 2 });
    expect(output.sourceMap[0x8001]).toMatchObject({ fileIndex: 0, line: 100 });
    expect(output.sourceMap[0x8002]).toMatchObject({ fileIndex: 0, line: 101 });
    expect(output.listFileItems.map((i) => i.lineNumber)).toContain(101);
  });

  it("redirects lines to another file", async () => {
    const output = await compile(
      ["  .org $8000", '#line 10 "prog.zxbas"', "  nop", "  nop", '#line 12 "prog.zxbas"', "  nop"].join("\n"),
      "/work/prog.kbasic.asm"
    );

    expect(output.errorCount).toBe(0);
    expect(output.sourceFileList.map((f) => f.filename)).toEqual(["/work/prog.kbasic.asm", "/work/prog.zxbas"]);
    expect(output.sourceMap[0x8000]).toMatchObject({ fileIndex: 1, line: 10 });
    expect(output.sourceMap[0x8001]).toMatchObject({ fileIndex: 1, line: 11 });
    expect(output.sourceMap[0x8002]).toMatchObject({ fileIndex: 1, line: 12 });
  });

  it("keeps an absolute file name", async () => {
    const output = await compile(['#line 5 "/lib/core.zxbas"', "  nop"].join("\n"), "/work/a.asm");
    expect(output.sourceFileList[1].filename).toBe(path.normalize("/lib/core.zxbas").replace(/\\/g, "/"));
  });

  it("reports assembly errors at the redirected location", async () => {
    const output = await compile(['#line 7 "prog.zxbas"', "  jp Missing"].join("\n"), "/work/a.asm");
    expect(output.errors[0]).toMatchObject({ filename: "/work/prog.zxbas", line: 7 });
  });

  it("accepts an expression", async () => {
    const output = await compile(["#line 2*10", "  nop"].join("\n"));
    expect(output.sourceMap[0x8000]).toMatchObject({ line: 20 });
  });

  it("does not affect an included file", async () => {
    const main = path.join(__dirname, "../testfiles/SingleInclude.z80asm");
    const output = await compile(
      ["  .org $8000", "#line 50", '#include "./inc1.z80asm"', "  nop"].join("\n"),
      main
    );
    expect(output.errorCount).toBe(0);
    expect(output.sourceMap[0x8000]).toMatchObject({ fileIndex: 1, line: 1 });
    expect(output.sourceMap[0x8001]).toMatchObject({ fileIndex: 0, line: 51 });
  });

  it("rejects a line number that is not a positive integer", async () => {
    for (const bad of ["0", '"x"', "-3"]) {
      const output = await compile(`#line ${bad}\n  nop`);
      expect(output.errors.map((e) => e.errorCode)).toContain("Z0209");
    }
  });
});

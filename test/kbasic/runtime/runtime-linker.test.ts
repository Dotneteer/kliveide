import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { ExpressionValue } from "@main/compiler-common/expressions";
import { runtimeBundle } from "@main/kbasic/runtime/generated/runtime-bundle";
import {
  resolveRuntimeModules,
  RuntimeUnitCache,
  runtimeInitialisers,
  runtimeUnits
} from "@main/kbasic/runtime/runtime-linker";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { assembleRuntimeProgram } from "./runtime-kit";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const indexer = require("../../../scripts/kbasic-runtime-index.cjs");

function options(defines: string[] = []): AssemblerOptions {
  const o = new AssemblerOptions();
  o.currentModel = SpectrumModelType.Spectrum48;
  for (const d of defines) o.predefinedSymbols[d] = new ExpressionValue(true);
  return o;
}

describe("Klive BASIC runtime - linker", () => {
  it("links a module after the modules it requires", () => {
    expect(resolveRuntimeModules(["core.StrConcat"]).map((m) => m.name)).toEqual([
      "program",
      "errors",
      "heap",
      "strings"
    ]);
  });

  it("accepts labels with or without core. and links each module once", () => {
    const names = resolveRuntimeModules(["Alloc", "core.Free", "core.StrDup", "PrintStr"]).map((m) => m.name);
    expect(names).toEqual([...new Set(names)]);
    expect(names).toEqual(["program", "errors", "heap", "print", "strings"]);
  });

  it("rejects a label no module exports", () => {
    expect(() => resolveRuntimeModules(["core.NoSuchRoutine"])).toThrow(/NoSuchRoutine/);
  });

  it("lists the initialisers in link order", () => {
    expect(runtimeInitialisers(resolveRuntimeModules(["PrintStr"]))).toEqual(["core.HeapInit", "core.PrintInit"]);
  });

  it("parses a module once per model and defines", async () => {
    const cache = new RuntimeUnitCache();
    const heap = resolveRuntimeModules(["Alloc"]).find((m) => m.name === "heap")!;
    const a = await cache.unit(heap, options());
    expect(await cache.unit(heap, options())).toBe(a);
    expect(await cache.unit(heap, options(["KB_CHECK_MEMORY"]))).not.toBe(a);
  });

  it("assembles every module together without a clash", async () => {
    const all = runtimeBundle.modules.flatMap((m) => m.exports);
    const { output, modules } = await assembleRuntimeProgram({ uses: all });
    expect(modules.length).toBe(runtimeBundle.modules.length);
    expect(output.errors.filter((e) => !e.isWarning)).toEqual([]);
  });

  it("assembles every module with every option symbol defined", async () => {
    const symbols = [...new Set(runtimeBundle.modules.flatMap((m) => m.symbols))];
    const all = runtimeBundle.modules.flatMap((m) => m.exports);
    const { output } = await assembleRuntimeProgram({ uses: all, defines: symbols });
    expect(output.errors.filter((e) => !e.isWarning)).toEqual([]);
  });

  it("puts the heap after the program, or at a fixed address", async () => {
    const after = await assembleRuntimeProgram({ uses: ["Alloc"], layout: { heapSize: 300 } });
    const core = after.output.getNestedModule("core")!;
    const start = core.getSymbol("HeapStart")!.value!.value as number;
    const end = after.output.segments[0].startAddress + after.output.segments[0].emittedCode.length;
    expect(end - start).toBe(300);

    const fixed = await assembleRuntimeProgram({ uses: ["Alloc"], layout: { heapSize: 300, heapAddress: 0xc000 } });
    expect(fixed.output.getNestedModule("core")!.getSymbol("HeapStart")!.value!.value).toBe(0xc000);
    expect(fixed.output.segments[0].emittedCode.length).toBeLessThan(after.output.segments[0].emittedCode.length);
  });

  it("names every runtime unit as a virtual file in the output", async () => {
    const o = options();
    const units = await runtimeUnits(resolveRuntimeModules(["StrDup"]), o);
    const assembler = new Z80Assembler();
    const main = await assembler.parseSourceUnit("main.asm", "  .org $8000\n  call core.StrDup\n  ret\n", o);
    const output = await new Z80Assembler().compileProgram([main, ...units], o);
    expect(output.sourceFileList.map((f) => f.filename)).toEqual([
      "main.asm",
      "<kbasic-runtime>/core-open.kz80.asm",
      "<kbasic-runtime>/program.kz80.asm",
      "<kbasic-runtime>/errors.kz80.asm",
      "<kbasic-runtime>/heap.kz80.asm",
      "<kbasic-runtime>/strings.kz80.asm",
      "<kbasic-runtime>/core-close.kz80.asm"
    ]);
  });
});

describe("Klive BASIC runtime - bundle generator", () => {
  function fixture(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kbasic-runtime-"));
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
    return dir;
  }

  const good = [
    "; @module   good",
    "; @summary  A module.",
    "; @exports  Entry",
    "; @symbols  KB_X",
    "Entry:",
    "#ifdef KB_X",
    "    nop",
    "#endif",
    "    ret"
  ].join("\n");

  it("the committed bundle is current", () => {
    const { bundle, errors } = indexer.buildBundle();
    expect(errors).toEqual([]);
    const onDisk = fs.readFileSync(indexer.BUNDLE_FILE, "utf8").replace(/\r\n?/g, "\n");
    expect(onDisk, "run `npm run kbasic:runtime`").toBe(indexer.renderBundle(bundle));
  });

  it("reads a module's header and normalises line ends", () => {
    const dir = fixture({ "good.kz80.asm": good.replace(/\n/g, "\r\n") });
    const { bundle, errors } = indexer.buildBundle(dir, path.join(dir, "none"));
    expect(errors).toEqual([]);
    expect(bundle.modules[0]).toMatchObject({ name: "good", exports: ["Entry"], requires: [], symbols: ["KB_X"] });
    expect(bundle.modules[0].text).not.toContain("\r");
  });

  it.each([
    ["a wrong @module", good.replace("@module   good", "@module   other"), /@module good/],
    ["a missing summary", good.replace("; @summary  A module.\n", ""), /@summary/],
    ["an unknown tag", `; @colour red\n${good}`, /unknown header tag @colour/],
    ["an undefined export", good.replace("@exports  Entry", "@exports  Entry, Ghost"), /Ghost is not defined/],
    ["an @init that is not exported", good.replace("; @symbols", "; @init Other\n; @symbols"), /@init Other/],
    ["an unlisted symbol", good.replace("; @symbols  KB_X\n", ""), /tests KB_X/],
    ["a listed symbol never tested", good.replace("KB_X\n", "KB_X, KB_Y\n"), /KB_Y .*never tests/],
    ["a .module line", `${good}\n    .module core`, /must not use .module/],
    ["an unknown requirement", good.replace("; @symbols", "; @requires ghost\n; @symbols"), /unknown module ghost/]
  ])("rejects %s", (_, text, message) => {
    const dir = fixture({ "good.kz80.asm": text });
    const { errors } = indexer.buildBundle(dir, path.join(dir, "none"));
    expect(errors.join("\n")).toMatch(message);
  });

  it("rejects a label exported twice and a requirement cycle", () => {
    const a = "; @module a\n; @summary A.\n; @exports Same\n; @requires b\nSame:\n    ret";
    const b = "; @module b\n; @summary B.\n; @exports same\n; @requires a\nsame:\n    ret";
    const dir = fixture({ "a.kz80.asm": a, "b.kz80.asm": b });
    const { errors } = indexer.buildBundle(dir, path.join(dir, "none"));
    expect(errors.join("\n")).toMatch(/also exported by a/);
    expect(errors.join("\n")).toMatch(/cycle: a -> b -> a/);
  });
});

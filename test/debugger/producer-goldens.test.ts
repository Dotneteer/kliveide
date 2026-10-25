import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import { parseMemoryMap } from "@main/boriel-integration/boriel-map";
import { adaptBorielDebugInfo } from "@main/boriel-integration/dbg-adapter";
import { adaptZ88dkDebugInfo } from "@main/z88dk-integration/z88dk-debug-adapter";
import { parseZ88dkMap, projectFileTest, z88dkLineDebug, z88dkLineRecords } from "@main/z88dk-integration/z88dk-map";

import { compileBasic } from "../kbasic/codegen/run-kit";

/**
 * The source-level debug information every producer writes (`.plans/SHARED_Z80_BACKEND_PLAN.md`
 * Part B, B0), kept in full so a change to the model shows as a readable diff: Klive BASIC (a few
 * corpus programs covering routines, GOSUB, ON ... GOSUB and CODEBANK), Boriel BASIC (the zxbc
 * fixtures) and z88dk C (the zx-hello fixture). `DEBUG_GOLDENS_UPDATE=1` re-records them.
 */
const GOLDENS = path.join(__dirname, "goldens");
const ROOT = path.resolve(__dirname, "../..");
const BORIEL = path.join(__dirname, "../boriel/fixtures");
const Z88DK = path.join(__dirname, "../z88dk/fixtures/zx-hello");
const CORPUS = path.join(__dirname, "../kbasic/corpus");

function check(name: string, info: SourceLevelDebugInfo): void {
  const file = path.join(GOLDENS, `${name}.json`);
  // --- File names are absolute: kept relative to the checkout, so the goldens hold on every machine
  const text = `${JSON.stringify(info, null, 1)}\n`.split(JSON.stringify(ROOT).slice(1, -1)).join("<root>");
  if (process.env.DEBUG_GOLDENS_UPDATE === "1" || !existsSync(file)) {
    mkdirSync(GOLDENS, { recursive: true });
    writeFileSync(file, text);
    return;
  }
  expect(JSON.parse(text), `${name}.json`).toEqual(JSON.parse(readFileSync(file, "utf8")));
}

function boriel(name: string, arch: string): SourceLevelDebugInfo {
  const folder = path.join(BORIEL, name);
  return adaptBorielDebugInfo({
    dbg: JSON.parse(readFileSync(path.join(folder, "program.dbg"), "utf8")),
    map: parseMemoryMap(readFileSync(path.join(folder, "program.map"), "utf8")),
    arch,
    baseFolder: folder,
    optimizationLevel: 2,
    image: { bytes: readFileSync(path.join(folder, "program.bin")), origin: 0x8000 },
    readFile: (f) => (existsSync(f) ? readFileSync(f, "utf8") : undefined)
  }).sourceLevelDebug;
}

describe("source-level debug information of every producer", () => {
  for (const program of ["routines/byref.zxbas", "control/gosub-nested.zxbas", "control/on-gosub.zxbas", "codebank/two-banks.zxbas", "routines/function-result.zxbas"]) {
    it(`Klive BASIC: ${program}`, async () => {
      const { generated } = await compileBasic(readFileSync(path.join(CORPUS, program), "utf8"), { optimize: 0 });
      check(`kbasic-${program.replace(/[/.]/g, "-")}`, generated.debug.sourceLevel);
    });
  }

  for (const [name, arch] of [["calls", "zx48k"], ["calls-next", "zxnext"], ["arrays", "zx48k"], ["runtime-error", "zx48k"]]) {
    it(`Boriel BASIC: ${name}`, () => check(`boriel-${name}`, boriel(name, arch)));
  }

  it("z88dk C: zx-hello", () => {
    const symbols = parseZ88dkMap(readFileSync(path.join(Z88DK, "program.map"), "utf8"));
    const isProjectFile = projectFileTest([Z88DK], "/opt/z88dk");
    const lineDebug = z88dkLineDebug(z88dkLineRecords(symbols, Z88DK, isProjectFile));
    const out = adaptZ88dkDebugInfo({
      symbols,
      lineDebug,
      cwd: Z88DK,
      isProjectFile,
      partitionOf: (b) => b,
      image: new Uint8Array(readFileSync(path.join(Z88DK, "program"))),
      origin: 0x8000
    });
    check("z88dk-zx-hello", out!.sourceLevelDebug);
  });
});

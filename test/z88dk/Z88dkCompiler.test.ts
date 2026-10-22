import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cLineCanHaveBreakpoint,
  z88dkOptionsFrom,
  Z88dkCompiler,
  zccArgumentsFor,
  type ZccRunner
} from "@main/z88dk-integration/Z88dkCompiler";
import { z88dkTargetFor, type Z88dkTarget } from "@main/z88dk-integration/z88dk-targets";
import { parseZccDiagnostics } from "@main/z88dk-integration/z88dk-diagnostics";

const FIXTURES = path.join(__dirname, "fixtures");
let temp: string;

beforeEach(() => (temp = fs.mkdtempSync(path.join(os.tmpdir(), "klive-z88dk-cc-"))));
afterEach(() => fs.rmSync(temp, { recursive: true, force: true }));

function target(machineId: string, modelId?: string, config?: Record<string, any>): Z88dkTarget {
  const result = z88dkTargetFor(machineId, modelId, config);
  if ("refused" in result) throw new Error(result.refused);
  return result;
}

const defaults = () => z88dkOptionsFrom(() => undefined);

describe("z88dkTargetFor (§5.2)", () => {
  it("maps each machine to its zcc target and Run route", () => {
    expect(target("sp48")).toMatchObject({ args: ["+zx"], run: "inject", appExtension: ".tap" });
    expect(target("sp128")).toMatchObject({ args: ["+zx"], model: 1, banking: "tape" });
    expect(target("spp3e")).toMatchObject({ args: ["+zx", "-subtype=plus3"], appExtension: ".dsk", model: 1 });
    expect(target("timex", undefined, {})).toMatchObject({ args: ["+zx"] });
    expect(target("timex", "ts2068", { timexModel: "ts2068" })).toMatchObject({ args: ["+ts2068"] });
    expect(target("zxnext")).toMatchObject({ args: ["+zxn", "-subtype=nex"], run: "nex", classicClib: "-clib=classic" });
    expect(target("zx81")).toMatchObject({ args: ["+zx81"], run: "program", appExtension: ".P" });
    expect(target("zx80")).toMatchObject({ args: ["+zx80"], run: "program", appExtension: ".O" });
    expect(target("zx80", undefined, { zx80Rom8K: true }).args).toEqual(["+zx81"]);
    expect(target("z88")).toMatchObject({ args: ["+z88", "-subtype=app"], run: "card", appExtension: ".epr" });
  });

  it("refuses the 16K Spectrum and the Commodore 64 with a reason", () => {
    expect(z88dkTargetFor("sp48", "pal-16k")).toEqual({ refused: expect.stringMatching(/16K Spectrum/) });
    expect(z88dkTargetFor("c64")).toEqual({ refused: expect.stringMatching(/6510/) });
  });

  it("takes the project's subtype", () => {
    expect((z88dkTargetFor("sp48", undefined, undefined, "plus3") as Z88dkTarget).args).toEqual(["+zx", "-subtype=plus3"]);
  });
});

describe("zccArgumentsFor", () => {
  it("builds a debug profile with -debug, no optimisation and the map", () => {
    expect(zccArgumentsFor(target("sp48"), defaults(), "debug", "/b/main", ["main.c"])).toEqual([
      "+zx", "-debug", "-O0", "-lndos", "-m", "-create-app", "-o", "/b/main", "main.c"
    ]);
  });

  it("builds a release profile with the project's optimisation, libraries, pragmas and extra arguments", () => {
    const options = z88dkOptionsFrom((key) =>
      ({
        "z88dk.optimise": "SO3",
        "z88dk.libs": ["m", "ndos"],
        "z88dk.pragmas": ["CRT_ORG_CODE=0x9000"],
        "z88dk.extraArgs": ["util.c", "gfx.asm"],
        "z88dk.startup": 1
      })[key]
    );
    expect(zccArgumentsFor(target("sp48"), options, "build", "/b/main", ["main.c"])).toEqual([
      "+zx", "-startup=1", "-SO3", "-lm", "-lndos", "-pragma-define:CRT_ORG_CODE=0x9000",
      "-m", "-create-app", "-o", "/b/main", "main.c", "util.c", "gfx.asm"
    ]);
  });

  it("asks the Next for its classic library, and SDCC for no -debug (C4)", () => {
    expect(zccArgumentsFor(target("zxnext"), defaults(), "debug", "/b/m", ["m.c"]).slice(0, 4)).toEqual([
      "+zxn", "-subtype=nex", "-clib=classic", "-debug"
    ]);
    const sdcc = z88dkOptionsFrom((key) => (key === "z88dk.compiler" ? "sdcc" : undefined));
    expect(zccArgumentsFor(target("sp48"), sdcc, "debug", "/b/m", ["m.c"])).not.toContain("-debug");
    expect(zccArgumentsFor(target("sp48"), sdcc, "debug", "/b/m", ["m.c"])).toContain("-compiler=sdcc");
  });

  it("links no ndos where the target or the library does not need it", () => {
    expect(zccArgumentsFor(target("zx81"), defaults(), "build", "/b/m", ["m.c"])).not.toContain("-lndos");
    const newlib = z88dkOptionsFrom((key) => (key === "z88dk.clib" ? "new" : undefined));
    expect(zccArgumentsFor(target("sp48"), newlib, "build", "/b/m", ["m.c"])).toEqual(
      expect.arrayContaining(["-clib=new"])
    );
    expect(zccArgumentsFor(target("sp48"), newlib, "build", "/b/m", ["m.c"])).not.toContain("-lndos");
  });
});

describe("parseZccDiagnostics", () => {
  it("reads every observed form, resolving files against the build folder", () => {
    for (const f of ["main.c", "bad.asm", "inc.c"]) fs.writeFileSync(path.join(temp, f), "");
    const output = [
      "main.c:3:13: error: Invalid expression",
      "main.c:5:33: fatal error: Unknown symbol: undefined_thing",
      "Compilation aborted",
      "main.c::main::1::2:4: error: undefined symbol: _f",
      "  ^---- _f",
      "bad.asm:4: warning: integer range: $12c",
      "inc.c:1: file 'nofile.h' not found",
      "stdio/fputc_callee.c::wrapper_fputc_callee_z80::0::1:54: error: undefined symbol: writebyte"
    ].join("\n");
    const root = path.join(temp, "main.c");
    const result = parseZccDiagnostics(output, temp, root).map((d) => [path.basename(d.filename), d.line, d.startColumn, !!d.isWarning, d.message]);
    expect(result).toEqual([
      ["main.c", 3, 12, false, "Invalid expression"],
      ["main.c", 5, 32, false, "Unknown symbol: undefined_thing"],
      ["main.c", 4, 0, false, "undefined symbol: _f"],
      ["bad.asm", 4, 0, true, "integer range: $12c"],
      ["inc.c", 1, 0, false, "file 'nofile.h' not found"],
      ["main.c", -1, 0, false, "undefined symbol: writebyte (in stdio/fputc_callee.c:54)"]
    ]);
  });
});

describe("cLineCanHaveBreakpoint", () => {
  it("accepts statements and declarations, not blanks, comments, braces or preprocessor lines", () => {
    expect(cLineCanHaveBreakpoint("    counter = add(3, 4);")).toBe(true);
    expect(cLineCanHaveBreakpoint("int add(int a, int b)")).toBe(true);
    for (const line of ["", "   ", "{", "}", "  // note", "/* block */", "#include <stdio.h>", " * comment"]) {
      expect(cLineCanHaveBreakpoint(line)).toBe(false);
    }
  });
});

// ─── Builds through a fake zcc that replays the committed fixtures ─────────────

/** A zcc stand-in: copies a fixture's outputs to `-o`'s name, prints `stderr` and exits with `exitCode`. */
function replay(fixture: string, run: { stderr?: string; exitCode?: number } = {}): ZccRunner & { calls: string[][] } {
  const calls: string[][] = [];
  const runner = (async (_zcc, args, { cwd }) => {
    calls.push(args);
    const output = args[args.indexOf("-o") + 1];
    if ((run.exitCode ?? 0) === 0) {
      for (const file of fs.readdirSync(path.join(FIXTURES, fixture))) {
        if (!file.startsWith("program")) continue;
        fs.copyFileSync(path.join(FIXTURES, fixture, file), output + file.slice("program".length));
      }
    }
    expect(cwd).toBeTruthy();
    return { exitCode: run.exitCode ?? 0, stdout: "", stderr: run.stderr ?? "", timedOut: false };
  }) as ZccRunner & { calls: string[][] };
  runner.calls = calls;
  return runner;
}

/** A project folder with the fixture's sources and an install-shaped z88dk folder. */
function project(fixture: string, machineId = "sp48", settings: Record<string, unknown> = {}) {
  const folder = path.join(temp, "project");
  fs.mkdirSync(folder, { recursive: true });
  for (const file of fs.readdirSync(path.join(FIXTURES, fixture))) {
    if (file.endsWith(".c")) fs.copyFileSync(path.join(FIXTURES, fixture, file), path.join(folder, file));
  }
  const root = path.join(temp, "z88dk");
  fs.mkdirSync(path.join(root, "bin"), { recursive: true });
  fs.mkdirSync(path.join(root, "lib", "config"), { recursive: true });
  fs.writeFileSync(path.join(root, "bin", process.platform === "win32" ? "zcc.exe" : "zcc"), "");
  const state: any = {
    project: { folderPath: folder, isKliveProject: true },
    emulatorState: { machineId },
    userSettings: { z88dk: { root } },
    projectSettings: settings
  };
  return { folder, state, main: path.join(folder, "main.c") };
}

describe("Z88dkCompiler (fixtures)", () => {
  it("turns a +zx debug build into segments, line tables, symbols and the tape artefact", async () => {
    const runner = replay("zx-hello");
    const compiler = new Z88dkCompiler(runner);
    const { state, main, folder } = project("zx-hello");
    compiler.setAppState(state);
    const out: any = await compiler.compileFile(main, undefined, "debug");
    expect(out.errors).toEqual([]);
    expect(runner.calls[0]).toEqual(expect.arrayContaining(["+zx", "-debug", "-O0", "-lndos", "main.c"]));
    expect(out.segments).toHaveLength(1);
    expect(out.segments[0].startAddress).toBe(0x8000);
    expect(out.segments[0].emittedCode.length).toBe(fs.statSync(path.join(FIXTURES, "zx-hello", "program")).size);
    expect(out.entryAddress).toBe(0x8000);
    expect(out.injectOptions).toEqual({ subroutine: true });
    expect(out.modelType).toBe(1);
    expect(out.sourceFileList.map((f: any) => path.basename(f.filename))).toEqual(["main.c"]);
    // --- add's body and main's statements, each at its address
    const lines = out.listFileItems.map((i: any) => [i.lineNumber, i.address]);
    expect(lines).toEqual(expect.arrayContaining([[9, expect.any(Number)], [16, expect.any(Number)], [18, expect.any(Number)]]));
    // --- Shared addresses go to the lower line (sccz80 reads one line ahead)
    const at16 = out.listFileItems.find((i: any) => i.lineNumber === 16).address;
    expect(out.sourceMap[at16].line).toBe(16);
    expect(out.symbols.main.value._value).toBe(at(out, 15));
    expect(out.symbols.counter).toMatchObject({ name: "counter", type: 2 });
    expect(out.z88dkArtefacts.tap).toBe(path.join(folder, "_klive", "z88dk", "debug", "main.tap"));
    expect(out.z88dkRun).toBe("inject");
  });

  it("adds a segment per filled bank and marks the banked lines' partition", async () => {
    const compiler = new Z88dkCompiler(replay("zx-banked"));
    const { state, main } = project("zx-banked", "sp128");
    compiler.setAppState(state);
    const out: any = await compiler.compileFile(main, undefined, "debug");
    expect(out.errors).toEqual([]);
    expect(out.segments).toHaveLength(2);
    expect(out.segments[1]).toMatchObject({ bank: 1, bankOffset: 0, startAddress: 0xc000 });
    expect(out.segments[1].emittedCode.length).toBe(fs.statSync(path.join(FIXTURES, "zx-banked", "program_BANK_1.bin")).size);
    // --- Run loads appmake's tape: its loader pages bank 1 in (48 BASIC injection locks the paging)
    expect(out.programFile).toBe(out.z88dkArtefacts.tap);
    const banked = out.listFileItems.filter((i: any) => i.partition === 1);
    expect(banked.length).toBeGreaterThan(0);
    expect(banked.every((i: any) => i.address >= 0xc000)).toBe(true);
  });

  it("hands the ZX81 its .P to load", async () => {
    const compiler = new Z88dkCompiler(replay("zx81-hello"));
    const { state, main, folder } = project("zx81-hello", "zx81");
    compiler.setAppState(state);
    const out: any = await compiler.compileFile(main, undefined, "build");
    expect(out.errors).toEqual([]);
    expect(out.programFile).toBe(path.join(folder, "_klive", "z88dk", "build", "main.P"));
    expect(out.segments[0].startAddress).toBe(0x4082);
    expect(out.modelType).toBe(6);
  });

  it("hands the Next the .nex appmake wrote", async () => {
    const compiler = new Z88dkCompiler(replay("zxn-hello"));
    const { state, main } = project("zxn-hello", "zxnext");
    compiler.setAppState(state);
    const out: any = await compiler.compileFile(main, undefined, "build");
    // --- The fixture keeps no map (too big): the build still runs, from __head... which the map gives,
    // --- so without one it reports the missing load address
    expect(out.errors[0].message).toMatch(/does not say where the program loads/);
  });

  it("reports zcc's diagnostics and writes nothing else", async () => {
    const compiler = new Z88dkCompiler(replay("zx-hello", { exitCode: 1, stderr: "main.c:16:5: error: Unknown symbol: nope" }));
    const { state, main } = project("zx-hello");
    compiler.setAppState(state);
    const out: any = await compiler.compileFile(main, undefined, "debug");
    expect(out.errors).toEqual([expect.objectContaining({ filename: main, line: 16, startColumn: 4, message: "Unknown symbol: nope" })]);
    expect(out.segments).toBeUndefined();
  });

  it("says how to set z88dk up when it is not configured", async () => {
    const compiler = new Z88dkCompiler(replay("zx-hello"));
    const { state, main } = project("zx-hello");
    compiler.setAppState({ ...state, userSettings: {}, projectSettings: {} });
    const out: any = await compiler.compileFile(main, undefined, "build");
    // --- Detection may find a real install on a developer's machine; CI has none
    if (out.errors.length) expect(out.errors[0].message).toMatch(/z88dk-setup|Integrations \| z88dk/);
  });

  it("refuses an unsupported machine before running zcc", async () => {
    const runner = replay("zx-hello");
    const compiler = new Z88dkCompiler(runner);
    const { state, main } = project("zx-hello", "c64");
    compiler.setAppState(state);
    const out: any = await compiler.compileFile(main, undefined, "build");
    expect(out.errors[0].message).toMatch(/6510/);
    expect(runner.calls).toHaveLength(0);
  });

  it("checks in the background only when the project opts in", async () => {
    const runner = replay("zx-hello", { exitCode: 1, stderr: "main.c:3:13: error: Invalid expression" });
    const compiler = new Z88dkCompiler(runner);
    const { state, main } = project("zx-hello");
    compiler.setAppState(state);
    expect(await compiler.checkFile(main)).toEqual({ errors: [] });
    expect(runner.calls).toHaveLength(0);
    compiler.setAppState({ ...state, projectSettings: { z88dk: { backgroundCheck: true } } });
    const checked: any = await compiler.checkFile(main);
    expect(runner.calls[0]).toEqual(expect.arrayContaining(["-c", "main.c"]));
    expect(checked.errors[0]).toMatchObject({ line: 3, message: "Invalid expression" });
  });
});

function at(out: any, line: number): number {
  return out.listFileItems.find((i: any) => i.lineNumber === line).address;
}

// ─── A real zcc, when this machine has one (never in CI) ───────────────────────
const realRoot = process.env.Z88DK_ROOT || path.join(os.homedir(), "z88dk");
describe.skipIf(!fs.existsSync(path.join(realRoot, "lib", "config")))("Z88dkCompiler (real zcc)", () => {
  it("builds the zx-hello fixture's source for the 48K", async () => {
    const compiler = new Z88dkCompiler();
    const { state, main } = project("zx-hello");
    compiler.setAppState({ ...state, userSettings: { z88dk: { root: realRoot } } });
    const out: any = await compiler.compileFile(main, undefined, "debug");
    expect(out.errors.filter((e: any) => !e.isWarning)).toEqual([]);
    expect(out.segments[0].startAddress).toBe(0x8000);
    expect(out.listFileItems.length).toBeGreaterThan(5);
  }, 120_000);
});

import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AppState } from "@common/state/AppState";
import { fnv1a32 } from "@main/boriel-integration/boriel-banked";
import { BorielCompiler, type ZxbcRunner } from "@main/boriel-integration/BorielCompiler";
import { argumentErrorText, parseZxbcDiagnostics } from "@main/boriel-integration/boriel-diagnostics";
import { EXPORT_OPTIONS, KLIVE_ONLY_OPTIONS, MAPPED_OPTIONS, zxbcArgumentsFor } from "@main/boriel-integration/boriel-options";
import { installBoriel } from "@main/boriel-integration/boriel-install-service";
import { borielKitLocation, locateBundledKit } from "@main/boriel-integration/boriel-kit";
import { defaultOptions, OPTION_SPECS } from "@main/kbasic/options/options";
import type { HeaderOption } from "@main/kbasic/options/header";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

const header = (...names: string[]): HeaderOption[] =>
  names.map((name) => ({ name, span: { file: 0, start: 0, end: 0 } }) as HeaderOption);

describe("Boriel BASIC options", () => {
  it("accounts for every Klive header option", () => {
    const unaccounted = OPTION_SPECS.map((o) => o.name).filter(
      (name) => !MAPPED_OPTIONS.has(name) && !EXPORT_OPTIONS.has(name) && !(name in KLIVE_ONLY_OPTIONS)
    );
    expect(unaccounted).toEqual([]);
  });

  it("maps the defaults", () => {
    const { arch, args } = zxbcArgumentsFor(defaultOptions("zx48k"), [], ":");
    expect(arch).toBe("zx48k");
    expect(args).toEqual([
      "--arch", "zx48k", "-O", "2", "--opt-strategy", "auto", "-S", "32768", "-H", "4768",
      "--array-base", "0", "--string-base", "0"
    ]);
  });

  it("maps flags, lists and targets", () => {
    const options = {
      ...defaultOptions("next"),
      optimize: 1,
      optimizeFor: "size" as const,
      requireDeclarations: true,
      requireTypes: true,
      checkMemory: true,
      checkBounds: true,
      breakKey: true,
      defines: [{ name: "A" }, { name: "B", value: "2" }],
      includePaths: ["/x", "/y"],
      disabledWarnings: ["W150"],
      enabledWarnings: ["W170"],
      nexStack: 0xfff0
    };
    const { arch, args } = zxbcArgumentsFor(options, [], ":");
    expect(arch).toBe("zxnext");
    expect(args.join(" ")).toContain("--opt-strategy size");
    for (const flag of ["--explicit", "--strict", "--debug-memory", "--debug-array", "--enable-break"]) expect(args).toContain(flag);
    expect(args.join(" ")).toContain("-D A -D B=2");
    // --- One include list: a repeated -I keeps only the last folder (Boriel plan B2)
    expect(args.join(" ")).toContain("-I /x:/y");
    expect(args.join(" ")).toContain("-W 150 +W 170");
    expect(args.join(" ")).toContain("--set:nex:sp 65520");
    expect(zxbcArgumentsFor(defaultOptions("zxplus3"), []).arch).toBe("zx128k");
  });

  it("uses -Z for Sinclair compatibility instead of separate bases", () => {
    const { args } = zxbcArgumentsFor({ ...defaultOptions(), sinclairCompatible: true, arrayBase: 1, stringBase: 1 }, []);
    expect(args).toContain("-Z");
    expect(args).not.toContain("--array-base");
  });

  it("warns about header options Boriel BASIC cannot honour", () => {
    const { warnings } = zxbcArgumentsFor({ ...defaultOptions(), asmDialect: "klive" }, header("asm-dialect", "codebank-window", "optimize"));
    expect(warnings.map((w) => w.option.name)).toEqual(["asm-dialect", "codebank-window"]);
    // --- Asking for zxbasm, Boriel's own dialect, needs no warning
    expect(zxbcArgumentsFor(defaultOptions(), header("asm-dialect")).warnings).toEqual([]);
  });
});

describe("Boriel BASIC diagnostics", () => {
  it("parses errors, warnings, codes and files", () => {
    const parsed = parseZxbcDiagnostics(
      [
        "/p/main.bas:2: error: [E342] Unexpected end of line",
        "inc/part.bas:6: warning: [W150] Variable 'grid' is never used",
        "/p/main.bas:3: error: file 'missing.bas' not found",
        "noise"
      ].join("\n"),
      "/p"
    );
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ errorCode: "E342", filename: "/p/main.bas", line: 2, message: "Unexpected end of line" });
    expect(parsed[0].isWarning).toBeUndefined();
    expect(parsed[1]).toMatchObject({ errorCode: "W150", filename: path.resolve("/p", "inc/part.bas"), isWarning: true });
    expect(parsed[2]).toMatchObject({ errorCode: "ZXBC", message: "file 'missing.bas' not found" });
  });

  it("finds the message in an argument error", () => {
    expect(argumentErrorText("usage: zxbc [-h]\n  PROGRAM\nzxbc: error: unrecognized arguments: -d=x\n")).toBe("unrecognized arguments: -d=x");
  });
});

// ─── The compiler, with a fake zxbc ──────────────────────────────────────────

/** What the fake zxbc writes: the image, a matching .dbg (or a broken one), diagnostics, an exit code. */
type FakeBehaviour = {
  image?: number[];
  diagnostics?: string;
  exitCode?: number;
  stderr?: string;
  wrongChecksum?: boolean;
  timedOut?: boolean;
  /** A .dbg whose data fails the adapter's checks (no main baseline). */
  brokenDebugData?: boolean;
  /** The code a run without `--debug` writes: the real zxbc generates other code then. */
  imageWithoutDebug?: number[];
  /** The code every `.nex` holds, whatever the flags. */
  nexImage?: number[];
};

function fakeZxbc(behaviour: FakeBehaviour, calls: { args: string[]; cwd: string }[]): ZxbcRunner {
  return async (_exe, args, { cwd }) => {
    calls.push({ args, cwd });
    if (behaviour.timedOut) return { stdout: "", stderr: "", timedOut: true };
    const value = (flag: string) => {
      const i = args.indexOf(flag);
      return i >= 0 ? args[i + 1] : undefined;
    };
    const errFile = value("-e");
    if (errFile && behaviour.diagnostics) fs.writeFileSync(errFile, behaviour.diagnostics);
    if ((behaviour.exitCode ?? 0) === 0) {
      const debug = args.find((a) => a.startsWith("--debug="))?.slice(8);
      const format = value("-f");
      const image = Buffer.from(
        (format === "nex" ? behaviour.nexImage : undefined) ??
          (!debug ? behaviour.imageWithoutDebug : undefined) ??
          behaviour.image ?? [0x3e, 0x01, 0xc9]
      );
      const out = value("-o");
      if (out) fs.writeFileSync(out, format === "nex" ? Buffer.concat([Buffer.from("NextV1.1"), image]) : image);
      if (debug) {
        fs.writeFileSync(
          debug,
          JSON.stringify({
            format: "zx-source-debug",
            version: 1,
            binaryLength: image.length,
            binaryChecksum: behaviour.wrongChecksum ? 1 : fnv1a32(image),
            sourceLevelDebug: {
              files: [],
              statements: [],
              callables: [{ index: 0, name: "main", kind: "entrypoint", entryAddress: 32768, exitAddresses: [] }],
              extensions: {
                frames: [{ callableIndex: 0, convention: "entrypoint", startAddress: 32768, bodyStart: 32768, epilogueStart: 32769 }],
                mainBaselineSymbol: behaviour.brokenDebugData ? 0 : 32790,
                callSites: [],
                variables: []
              }
            }
          })
        );
      }
    }
    return { exitCode: behaviour.exitCode ?? 0, stdout: "", stderr: behaviour.stderr ?? "", timedOut: false };
  };
}

describe("BorielCompiler", () => {
  let project: string;
  let zxbc: string;
  let source: string;
  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), "klive-boriel-build-"));
    zxbc = path.join(project, "zxbc");
    fs.writeFileSync(zxbc, "");
    source = path.join(project, "code", "program.zxbas");
    fs.mkdirSync(path.dirname(source));
    fs.writeFileSync(source, "' A program\n'@optimize 2\nPRINT 1\n");
  });
  afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

  const appState = (machineId = "sp48", userSettings: Record<string, unknown> = {}) =>
    ({
      userSettings: { zxbasic: { executablePath: zxbc }, ...userSettings },
      projectSettings: {},
      project: { folderPath: project, isKliveProject: true },
      emulatorState: { machineId }
    }) as unknown as AppState;

  const compilerWith = (behaviour: FakeBehaviour, machineId?: string) => {
    const calls: { args: string[]; cwd: string }[] = [];
    const compiler = new BorielCompiler(fakeZxbc(behaviour, calls));
    compiler.setAppState(appState(machineId));
    return { compiler, calls };
  };

  it("builds a segment, the model and the entry, in _klive/boriel", async () => {
    const { compiler, calls } = compilerWith({ image: [1, 2, 3, 4] });
    const output: any = await compiler.compileFile(source);
    expect(output.errors).toEqual([]);
    expect(output.segments).toEqual([{ startAddress: 0x8000, emittedCode: [1, 2, 3, 4] }]);
    expect(output.modelType).toBe(SpectrumModelType.Spectrum48);
    expect(output.entryAddress).toBe(32768);
    expect(output.injectOptions).toEqual({ subroutine: true });
    expect(output.sourceFileList).toEqual([]);
    const buildFolder = path.join(project, "_klive", "boriel");
    expect(calls[0].cwd).toBe(buildFolder);
    expect(calls[0].args[0]).toBe(source);
    expect(calls[0].args).toContain(`--debug=${path.join(buildFolder, "program.dbg")}`);
    expect(calls[0].args.join(" ")).toContain(`-f bin -o ${path.join(buildFolder, "program.bin")}`);
  });

  it("caps a debug build at level 1 unless the header sets '@optimize", async () => {
    fs.writeFileSync(source, "PRINT 1\n");
    const { compiler, calls } = compilerWith({});
    const output = await compiler.compileFile(source, undefined, "debug");
    expect(calls[0].args.join(" ")).toContain("-O 1");
    expect(output.traceOutput?.join("\n")).toMatch(/debug build at optimisation level 1/);

    fs.writeFileSync(source, "'@optimize 2\nPRINT 1\n");
    const second = compilerWith({});
    await second.compiler.compileFile(source, undefined, "debug");
    expect(second.calls[0].args.join(" ")).toContain("-O 2");
  });

  it("reports zxbc's diagnostics, keeping warnings", async () => {
    const failing = compilerWith({ exitCode: 1, diagnostics: `${source}:3: error: [E342] Unexpected end of line\n` });
    const failed = await failing.compiler.compileFile(source);
    expect(failed.errors?.[0]).toMatchObject({ errorCode: "E342", line: 3 });
    expect((failed as any).segments).toBeUndefined();

    const warning = compilerWith({ diagnostics: `${source}:3: warning: [W150] Variable 'x' is never used\n` });
    const warned: any = await warning.compiler.compileFile(source);
    expect(warned.errors).toEqual([expect.objectContaining({ errorCode: "W150", isWarning: true })]);
    expect(warned.segments).toHaveLength(1);
  });

  it("refuses a debug file that does not match the binary", async () => {
    const { compiler } = compilerWith({ wrongChecksum: true });
    const output = await compiler.compileFile(source);
    expect(output.errors?.[0].message).toMatch(/checksum mismatch/);
  });

  it("warns when the debug information fails its checks, and still builds", async () => {
    const { compiler } = compilerWith({ brokenDebugData: true });
    const output: any = await compiler.compileFile(source);
    expect(output.errors).toEqual([expect.objectContaining({ errorCode: "ZXBC-D", isWarning: true, message: expect.stringMatching(/failed 1 check/) })]);
    expect(output.traceOutput.join("\n")).toMatch(/debug information check: no main baseline symbol/);
    expect(output.segments).toHaveLength(1);
    expect(output.sourceLevelDebug).toBeDefined();
  });

  it("explains argument errors and timeouts", async () => {
    const args = compilerWith({ exitCode: 2, stderr: "usage: zxbc\nzxbc: error: bad flag\n" });
    expect((await args.compiler.compileFile(source)).errors?.[0].message).toBe("zxbc rejected its arguments: bad flag");
    const slow = compilerWith({ timedOut: true });
    expect((await slow.compiler.compileFile(source)).errors?.[0].message).toMatch(/did not finish/);
  });

  it("searches the source's folder, then the include folders, for USEd modules", async () => {
    const { compiler, calls } = compilerWith({});
    await compiler.compileFile(source);
    const m = calls[0].args[calls[0].args.indexOf("-m") + 1];
    expect(m).toBe(path.dirname(source));
    const { args } = zxbcArgumentsFor({ ...defaultOptions(), includePaths: ["/lib"] }, [], ":", "/src");
    expect(args[args.indexOf("-m") + 1]).toBe("/src:/lib");
  });

  it("splits modules into banks only on a machine that has banks", () => {
    const flag = header("split-modules");
    const banked = zxbcArgumentsFor({ ...defaultOptions("zx128k"), splitModules: true }, flag);
    expect(banked.args).toContain("--split-modules");
    expect(banked.warnings).toEqual([]);
    const flat = zxbcArgumentsFor({ ...defaultOptions("zx48k"), splitModules: true }, flag);
    expect(flat.args).not.toContain("--split-modules");
    expect(flat.warnings[0].message).toMatch(/no RAM banks/);
  });

  it("builds the Next's .nex with zxbc and hands it over", async () => {
    const { compiler, calls } = compilerWith({ image: [9, 9] }, "zxnext");
    const output: any = await compiler.compileFile(source);
    expect(output.modelType).toBe(SpectrumModelType.Next);
    expect(output.nexConfig).toEqual({ filename: "program.nex" });
    expect(Buffer.from(output.prebuiltNex).subarray(0, 8).toString()).toBe("NextV1.1");
    expect(calls.map((c) => c.args[c.args.indexOf("-f") + 1])).toEqual(["bin", "nex"]);
    expect(calls[0].args.join(" ")).toContain("--arch zxnext");
    expect(output.errors).toEqual([]);
  });

  it("builds the .nex with --debug, which changes zxbc's code, so it holds the debugged program", async () => {
    // --- zxbc 2.0.0-beta25 generates other code without --debug: the Next ran that while the
    // --- debugger read the .bin's addresses, so no breakpoint ever fired (plan §6)
    const { compiler, calls } = compilerWith({ image: [1, 2, 3, 4], imageWithoutDebug: [1, 2, 9, 9, 4] }, "zxnext");
    const output: any = await compiler.compileFile(source);
    expect(calls[1].args.some((a) => a.startsWith("--debug="))).toBe(true);
    expect(calls[1].args).not.toContain(`--debug=${path.join(project, "_klive", "boriel", "program.dbg")}`);
    expect(Buffer.from(output.prebuiltNex).subarray(8)).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(output.errors).toEqual([]);
    // --- That run's .dbg is never read, and does not stay in the build folder
    expect(fs.existsSync(calls[1].args.find((a) => a.startsWith("--debug="))!.slice(8))).toBe(false);
  });

  it("warns when the .nex does not hold the debugged code", async () => {
    const { compiler } = compilerWith({ image: [1, 2, 3, 4], nexImage: [1, 2, 9, 9] }, "zxnext");
    const output: any = await compiler.compileFile(source);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toMatchObject({ errorCode: "ZXBC-D", isWarning: true });
    expect(output.errors[0].message).toMatch(/holds other code than the debugged build/);
    expect(output.prebuiltNex).toBeDefined();
  });

  it("maps Klive's machines to zxbc architectures and inject models", async () => {
    for (const [machine, arch, model] of [
      ["timex", "zx48k", SpectrumModelType.Spectrum48],
      ["sp128", "zx128k", SpectrumModelType.Spectrum128],
      ["scorpion", "zx128k", SpectrumModelType.Spectrum128],
      ["spp3e", "zx128k", SpectrumModelType.SpectrumP3]
    ] as const) {
      const { compiler, calls } = compilerWith({}, machine);
      const output: any = await compiler.compileFile(source);
      expect(calls[0].args.join(" ")).toContain(`--arch ${arch}`);
      expect(output.modelType).toBe(model);
    }
    const { compiler, calls } = compilerWith({}, "zx81");
    expect((await compiler.compileFile(source)).errors?.[0].message).toMatch(/does not build programs for this machine/);
    expect(calls).toEqual([]);
  });

  it("passes a project.ini explicitly, never through the working folder", async () => {
    fs.writeFileSync(path.join(project, "project.ini"), "[zxbc]\norg = 40000\n");
    const { compiler, calls } = compilerWith({});
    const output = await compiler.compileFile(source);
    expect(calls[0].args.join(" ")).toContain(`-F ${path.join(project, "project.ini")}`);
    expect(output.traceOutput?.join("\n")).toMatch(/project\.ini/);
  });

  it("checks in the background with --parse-only", async () => {
    const { compiler, calls } = compilerWith({ diagnostics: "" });
    const output = await compiler.checkFile(source);
    expect(output.errors).toEqual([]);
    expect(calls[0].args).toContain("--parse-only");
    expect(calls[0].args).not.toContain("-o");
  });

  it("reports header problems and Klive-only options before running zxbc", async () => {
    fs.writeFileSync(source, "'@optimize 9\nPRINT 1\n");
    const bad = compilerWith({});
    const output = await bad.compiler.compileFile(source);
    expect(output.errors?.some((e) => !e.isWarning && e.line === 1)).toBe(true);
    expect(bad.calls).toEqual([]);

    fs.writeFileSync(source, "'@codebank-window $C000\nPRINT 1\n");
    const kliveOnly = compilerWith({});
    const built = await kliveOnly.compiler.compileFile(source);
    expect(built.errors).toEqual([expect.objectContaining({ errorCode: "ZXBC-H", isWarning: true, line: 1 })]);
  });

  it("says when Boriel BASIC is not set up", async () => {
    const compiler = new BorielCompiler(fakeZxbc({}, []));
    compiler.setAppState({ userSettings: {}, projectSettings: {}, emulatorState: { machineId: "sp48" } } as unknown as AppState);
    expect((await compiler.compileFile(source)).errors?.[0].message).toMatch(/not set up/);
  });
});

// ─── The real zxbc, when this checkout has the kit for this machine ──────────

describe("BorielCompiler with the real zxbc", () => {
  const location = borielKitLocation(false, "", path.resolve(__dirname, "../.."));
  const available = locateBundledKit(location).kit.kind === "available";
  let home: string;
  let zxbcPath: string;
  beforeAll(async () => {
    if (!available) return;
    home = fs.mkdtempSync(path.join(os.tmpdir(), "klive-boriel-real-build-"));
    const result = await installBoriel(path.join(home, "zxbasic2"), {
      kitLocation: location,
      platformKey: `${process.platform}-${process.arch}`,
      platform: process.platform,
      homeDir: home,
      protectedFolders: [],
      settings: { readSetting: () => undefined },
      setupRecord: undefined
    });
    if (result.kind !== "installed") throw new Error(result.error);
    zxbcPath = result.executablePath;
  }, 60_000);
  afterAll(() => home && fs.rmSync(home, { recursive: true, force: true }));

  it.skipIf(!available)("compiles the BASIC template and reports a real error", async () => {
    const project = path.join(home, "project");
    fs.mkdirSync(path.join(project, "code"), { recursive: true });
    const source = path.join(project, "code", "program.zxbas");
    fs.copyFileSync(path.resolve(__dirname, "../../src/public/project-templates/sp48/zx-basic/code/program.zxbas"), source);
    const compiler = new BorielCompiler();
    compiler.setAppState({
      userSettings: { zxbasic: { executablePath: zxbcPath } },
      projectSettings: {},
      project: { folderPath: project, isKliveProject: true },
      emulatorState: { machineId: "sp48" }
    } as unknown as AppState);
    const output: any = await compiler.compileFile(source);
    expect(output.errors.filter((e: any) => !e.isWarning)).toEqual([]);
    expect(output.segments[0].startAddress).toBe(0x8000);
    expect(output.segments[0].emittedCode.length).toBeGreaterThan(100);
    expect(output.entryAddress).toBe(0x8000);

    fs.writeFileSync(source, "DIM a As UByte\na = 1 +\n");
    const failed = await compiler.compileFile(source);
    expect(failed.errors?.[0]).toMatchObject({ errorCode: "E342", filename: source, line: 2 });
    const checked = await compiler.checkFile(source);
    expect(checked.errors?.[0]).toMatchObject({ errorCode: "E342", line: 2 });
  }, 60_000);

  it.skipIf(!available)("builds a banked program (--split-modules) for the 128K and the Next", async () => {
    // --- The banked fixture's sources, in a project of their own, with the option in the header
    const project = path.join(home, "banked");
    const code = path.join(project, "code");
    fs.mkdirSync(code, { recursive: true });
    const fixture = path.resolve(__dirname, "../boriel/fixtures/banked-128");
    for (const file of fs.readdirSync(fixture).filter((f) => f.endsWith(".bas"))) {
      fs.copyFileSync(path.join(fixture, file), path.join(code, file === "program.bas" ? "program.zxbas" : file));
    }
    const source = path.join(code, "program.zxbas");
    fs.writeFileSync(source, "'@split-modules\n" + fs.readFileSync(source, "utf8"));

    for (const [machineId, banks] of [
      ["sp128", [0, 1]],
      ["zxnext", [16, 17]]
    ] as const) {
      const compiler = new BorielCompiler();
      compiler.setAppState({
        userSettings: { zxbasic: { executablePath: zxbcPath } },
        projectSettings: {},
        project: { folderPath: project, isKliveProject: true },
        emulatorState: { machineId }
      } as unknown as AppState);
      const output: any = await compiler.compileFile(source, undefined, "debug");
      expect(output.errors.filter((e: any) => !e.isWarning), machineId).toEqual([]);
      expect(output.segments.map((s: any) => s.bank), machineId).toEqual([undefined, ...banks]);
      expect(output.segments[0].startAddress).toBe(0x8000);
      // --- A module's lines name their bank's segment, so their breakpoints get the partition
      const big3 = output.sourceFileList.findIndex((f: any) => f.filename.endsWith("big3.bas"));
      const lines = output.listFileItems.filter((li: any) => li.fileIndex === big3);
      expect(lines.length, machineId).toBeGreaterThan(0);
      expect(lines.every((li: any) => output.segments[li.segmentIndex].bank === banks[1]), machineId).toBe(true);
      expect(output.sourceLevelDebug.extensions.codebank.shadowStackKind).toBe("zxbc");
      if (machineId === "zxnext") {
        expect(Buffer.from(output.prebuiltNex).subarray(0, 4).toString()).toBe("Next");
        expect(output.nexConfig).toEqual({ filename: "program.nex" });
      } else {
        expect(output.prebuiltNex).toBeUndefined();
      }
    }
  }, 120_000);
});

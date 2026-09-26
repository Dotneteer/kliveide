import { describe, expect, it } from "vitest";
import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { SourceSet } from "@main/kbasic/syntax/source";
import {
  applyDebugProfile,
  applyHeader,
  optionsFromSettings,
  readHeader,
  reportIgnoredHeader
} from "@main/kbasic/options/header";
import { defaultOptions, parseNumber } from "@main/kbasic/options/options";

function header(text: string) {
  const diagnostics = new DiagnosticBag();
  const file = new SourceSet().add("main.bas", text);
  return { file, options: readHeader(file, diagnostics), diagnostics };
}

function compile(text: string, base = defaultOptions()) {
  const { options: lines, diagnostics } = header(text);
  const options = applyHeader(base, lines, diagnostics);
  return { options, lines, diagnostics, codes: diagnostics.items.map((d) => d.code) };
}

describe("readHeader", () => {
  it("reads '@ lines with and without '='", () => {
    const { options, diagnostics } = header("'@target next\n'@optimize = 3\n'@heap-size=4096\n");
    expect(options.map((o) => [o.name, o.value])).toEqual([
      ["target", "next"],
      ["optimize", "3"],
      ["heap-size", "4096"]
    ]);
    expect(diagnostics.items).toEqual([]);
  });

  it("reads the REM form, in any case", () => {
    const { options } = header("REM @break-key\nrem @array-base 1\n");
    expect(options.map((o) => [o.name, o.value])).toEqual([
      ["break-key", undefined],
      ["array-base", "1"]
    ]);
  });

  it("does not take REMARK for REM", () => {
    const { options } = header("REMARK @break-key\n");
    expect(options).toEqual([]);
  });

  it("lower-cases option names", () => {
    expect(header("'@Heap-Size 100").options[0].name).toBe("heap-size");
  });

  it("skips blank lines and ordinary comments", () => {
    const { options } = header("' My game\n\n   \n'@target next\nREM written in 2026\n'@optimize 1\n");
    expect(options.map((o) => o.name)).toEqual(["target", "optimize"]);
  });

  it("ends at the first code line", () => {
    const { options } = header("'@target next\nPRINT \"Hi\"\n'@optimize 1\n");
    expect(options.map((o) => o.name)).toEqual(["target"]);
  });

  it("ends at a preprocessor line", () => {
    const { options } = header("'@target next\n#include <input.bas>\n'@optimize 1\n");
    expect(options.map((o) => o.name)).toEqual(["target"]);
  });

  it("strips a trailing comment but not a quote inside a string", () => {
    const { options } = header(`'@heap-size 4096 ' the default\n'@nex-loading-screen "it's.bmp" ' screen\n`);
    expect(options.map((o) => o.value)).toEqual(["4096", `"it's.bmp"`]);
  });

  it("gives each option the span of its line", () => {
    const text = "' x\n  '@target next  \n";
    const { options } = header(text);
    expect(text.slice(options[0].span.start, options[0].span.end)).toBe("'@target next  ");
  });

  it("translates NextBuild '! lines", () => {
    const { options, diagnostics } = header("'!org=24576\n'!heap=2048\n'!opt=3\n'!bmp=screen.bmp\n");
    expect(options.map((o) => [o.name, o.value, o.alias])).toEqual([
      ["origin", "24576", "org"],
      ["heap-size", "2048", "heap"],
      ["optimize", "3", "opt"],
      ["nex-loading-screen", "screen.bmp", "bmp"]
    ]);
    expect(diagnostics.items).toEqual([]);
  });

  it("warns K011 on a NextBuild option Klive does not take", () => {
    const { options, diagnostics } = header("'!copy=c:/out\n'!nosys\n");
    expect(options).toEqual([]);
    expect(diagnostics.items.map((d) => [d.code, d.severity])).toEqual([
      ["K011", "warning"],
      ["K011", "warning"]
    ]);
    expect(diagnostics.items[0].message).toContain("'!copy");
  });

  it("warns K010 on an unknown NextBuild option", () => {
    const { diagnostics } = header("'!frobnicate=1\n");
    expect(diagnostics.items.map((d) => d.code)).toEqual(["K010"]);
  });

  it("reads nothing from a file without a header", () => {
    expect(header("PRINT 1\n").options).toEqual([]);
    expect(header("").options).toEqual([]);
  });
});

describe("applyHeader", () => {
  it("applies values of every kind", () => {
    const { options, diagnostics } = compile(
      [
        "'@target next",
        "'@optimize 3",
        "'@optimize-for size",
        "'@origin $6000",
        "'@heap-address 0xC000",
        "'@heap-size %1000000000",
        "'@break-key",
        "'@check-bounds off",
        "'@nex-core 3.1.10",
        "'@nex-loading-screen \"title.bmp\""
      ].join("\n")
    );
    expect(diagnostics.items).toEqual([]);
    expect(options).toMatchObject({
      target: "next",
      optimize: 3,
      optimizeFor: "size",
      origin: 0x6000,
      heapAddress: 0xc000,
      heapSize: 512,
      breakKey: true,
      checkBounds: false,
      nexCore: "3.1.10",
      nexLoadingScreen: "title.bmp"
    });
  });

  it("accepts every flag spelling", () => {
    for (const [text, value] of [
      ["on", true],
      ["TRUE", true],
      ["yes", true],
      ["off", false],
      ["false", false],
      ["No", false]
    ] as const) {
      expect(compile(`'@break-key ${text}`, { ...defaultOptions(), breakKey: !value }).options.breakKey).toBe(value);
    }
  });

  it("leaves the base options untouched", () => {
    const base = defaultOptions();
    compile("'@define A\n'@optimize 0", base);
    expect(base).toEqual(defaultOptions());
  });

  it("parses defines with and without values", () => {
    const { options } = compile("'@define DEBUG, LEVEL=3, NAME = \"a,b\"");
    expect(options.defines).toEqual([
      { name: "DEBUG" },
      { name: "LEVEL", value: "3" },
      { name: "NAME", value: '"a,b"' }
    ]);
  });

  it("accumulates list options across lines", () => {
    const { options } = compile("'@include-path lib, \"my libs\"\n'@include-path extra");
    expect(options.includePaths).toEqual(["lib", "my libs", "extra"]);
  });

  it("normalises warning codes", () => {
    const { options } = compile("'@disable-warning 150, w170\n'@enable-warning W100");
    expect(options.disabledWarnings).toEqual(["W150", "W170"]);
    expect(options.enabledWarnings).toEqual(["W100"]);
  });

  it("reads headless append blocks", () => {
    const { options } = compile("'@append-block data.bin, headless:music.bin");
    expect(options.appendBlocks).toEqual([
      { file: "data.bin", headless: false },
      { file: "music.bin", headless: true }
    ]);
  });

  it("reads codebank pages", () => {
    expect(compile("'@codebank-pages 40, $2A, 44").options.codebankPages).toEqual([40, 42, 44]);
  });

  it("sets Sinclair compatibility's side effects", () => {
    const { options } = compile("'@sinclair-compatible");
    expect(options).toMatchObject({ sinclairCompatible: true, arrayBase: 1, stringBase: 1, caseInsensitive: true });
  });

  it("lets a later line override an earlier one", () => {
    expect(compile("'@optimize 1\n'@optimize 3").options.optimize).toBe(3);
  });

  it("warns K010 with a suggestion on an unknown option", () => {
    const { diagnostics, options } = compile("'@optimise 3");
    expect(diagnostics.items.map((d) => [d.code, d.severity])).toEqual([["K010", "warning"]]);
    expect(diagnostics.items[0].message).toContain("did you mean '@optimize'?");
    expect(options.optimize).toBe(defaultOptions().optimize);
  });

  it("gives no suggestion when nothing is close", () => {
    const { diagnostics } = compile("'@wibble 3");
    expect(diagnostics.items[0].message).not.toContain("did you mean");
  });

  it.each([
    ["'@optimize 4", "a number from 0 to 3"],
    ["'@optimize fast", "a number from 0 to 3"],
    ["'@origin 70000", "a number from 0 to 65535"],
    ["'@target spectrum", "next, zx48k, zx128k, zxplus3"],
    ["'@break-key maybe", "on or off"],
    ["'@nex-core 3.1", "a version such as 3.0.0"],
    ["'@define", "a comma-separated list"],
    ["'@nex-loading-screen", "a value"]
  ])("reports E001 on a bad value: %s", (text, expected) => {
    const { diagnostics, options } = compile(text);
    expect(diagnostics.items.map((d) => [d.code, d.severity])).toEqual([["E001", "error"]]);
    expect(diagnostics.items[0].message).toContain(expected);
    expect({ ...options, defines: [] }).toEqual({ ...defaultOptions(), defines: [] });
  });

  it("applies translated NextBuild options", () => {
    const { options, diagnostics } = compile("'!org=$6000\n'!opt=1\n'!codebank=40\n'!codewindowsize=16k");
    expect(diagnostics.items).toEqual([]);
    expect(options).toMatchObject({ origin: 0x6000, optimize: 1, codebankFirstPage: 40, codebankWindowSize: "16k" });
  });
});

describe("reportIgnoredHeader", () => {
  it("reports K012 as info on an included file's header", () => {
    const diagnostics = new DiagnosticBag();
    const file = new SourceSet().add("lib.bas", "' library\n'@optimize 3\n'@target next\nSUB f: END SUB\n");
    reportIgnoredHeader(file, diagnostics);
    expect(diagnostics.items.map((d) => [d.code, d.severity])).toEqual([["K012", "info"]]);
    expect(file.text.slice(diagnostics.items[0].span.start, diagnostics.items[0].span.end)).toBe("'@optimize 3");
  });

  it("says nothing about a file without one", () => {
    const diagnostics = new DiagnosticBag();
    reportIgnoredHeader(new SourceSet().add("lib.bas", "' library\nSUB f: END SUB\n"), diagnostics);
    expect(diagnostics.items).toEqual([]);
  });
});

describe("optionsFromSettings", () => {
  const settings = (values: Record<string, unknown>) => (key: string) => values[key];

  it("picks the target from the machine", () => {
    expect(optionsFromSettings(settings({})).target).toBe("zx48k");
    expect(optionsFromSettings(settings({}), "sp48").target).toBe("zx48k");
    expect(optionsFromSettings(settings({}), "sp128").target).toBe("zx128k");
    expect(optionsFromSettings(settings({}), "spp3e").target).toBe("zxplus3");
    const next = optionsFromSettings(settings({}), "zxnext");
    expect(next.target).toBe("next");
    expect(next.output).toBe("nex");
  });

  it("maps the zxbasic settings", () => {
    const o = optionsFromSettings(
      settings({
        "zxbasic.optimizationLevel": 3,
        "zxbasic.machineCodeOrigin": "$6000",
        "zxbasic.heapSize": 2048,
        "zxbasic.oneAsArrayBaseIndex": true,
        "zxbasic.oneAsStringBaseIndex": "true",
        "zxbasic.debugMemory": true,
        "zxbasic.debugArray": true,
        "zxbasic.enableBreak": true,
        "zxbasic.explicitVariables": true,
        "zxbasic.strictMode": true
      })
    );
    expect(o).toMatchObject({
      optimize: 3,
      origin: 0x6000,
      heapSize: 2048,
      arrayBase: 1,
      stringBase: 1,
      checkMemory: true,
      checkBounds: true,
      breakKey: true,
      requireDeclarations: true,
      requireTypes: true
    });
  });

  it("ignores out-of-range and false settings", () => {
    const o = optionsFromSettings(settings({ "zxbasic.optimizationLevel": 9, "zxbasic.enableBreak": false }));
    expect(o.optimize).toBe(defaultOptions().optimize);
    expect(o.breakKey).toBe(false);
  });

  it("applies Sinclair compatibility", () => {
    expect(optionsFromSettings(settings({ "zxbasic.sinclair": true }))).toMatchObject({
      sinclairCompatible: true,
      caseInsensitive: true,
      arrayBase: 1
    });
  });

  it("is overridden by the header", () => {
    const base = optionsFromSettings(settings({ "zxbasic.optimizationLevel": 3 }));
    expect(compile("'@optimize 1", base).options.optimize).toBe(1);
  });
});

describe("applyDebugProfile", () => {
  it("caps the optimisation level at 1", () => {
    const { options, lines } = compile("'@target next", { ...defaultOptions(), optimize: 3 });
    expect(applyDebugProfile(options, lines)).toMatchObject({ optimize: 1, debugInfo: "full" });
  });

  it("keeps a lower level", () => {
    const { options, lines } = compile("'@target next", { ...defaultOptions(), optimize: 0 });
    expect(applyDebugProfile(options, lines).optimize).toBe(0);
  });

  it("keeps a level the header pins", () => {
    const { options, lines } = compile("'@optimize 3");
    expect(applyDebugProfile(options, lines).optimize).toBe(3);
  });

  it("keeps a level NextBuild's '!opt pins", () => {
    const { options, lines } = compile("'!opt=2");
    expect(applyDebugProfile(options, lines).optimize).toBe(2);
  });
});

describe("parseNumber", () => {
  it.each([
    ["123", 123],
    ["-5", -5],
    ["$ff", 255],
    ["0x1F", 31],
    ["%101", 5],
    [" 7 ", 7],
    ["12a", undefined],
    ["$", undefined],
    ["", undefined]
  ])("%s", (text, value) => {
    expect(parseNumber(text)).toBe(value);
  });
});

import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import { mapSymbols, parseMemoryMap } from "@main/boriel-integration/boriel-map";
import { adaptBorielDebugInfo, validateSourceLevel, type DbgAdapterOutput } from "@main/boriel-integration/dbg-adapter";
import { extractBankedProgram, programBankIds } from "@main/boriel-integration/boriel-banked";
import { parseZ80File } from "@common/spectrum/snapshot/z80File";
import { loadNexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";

/*
 * The .dbg adapter on zxbc's real output (`test/boriel/fixtures/`, README there). Each expectation
 * names the Phase B0 correction it checks (`.ai/boriel/dbg-observed.md`).
 */

const FIXTURES = path.join(__dirname, "fixtures");

function adapt(name: string, arch = "zx48k", libraryFolder?: string): DbgAdapterOutput & { source: string[] } {
  const folder = path.join(FIXTURES, name);
  const out = adaptBorielDebugInfo({
    dbg: JSON.parse(fs.readFileSync(path.join(folder, "program.dbg"), "utf8")),
    map: parseMemoryMap(fs.readFileSync(path.join(folder, "program.map"), "utf8")),
    arch,
    baseFolder: folder,
    libraryFolder,
    optimizationLevel: 2,
    image: { bytes: fs.readFileSync(path.join(folder, "program.bin")), origin: 0x8000 },
    readFile: (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined)
  });
  return { ...out, source: fs.readFileSync(path.join(folder, "program.bas"), "utf8").split("\n") };
}

/** The statement starting on `line`, the n-th there. */
const statementOn = (sld: SourceLevelDebugInfo, line: number, nth = 0) =>
  sld.statements.filter((s) => s.startLine === line).sort((a, b) => a.startColumn - b.startColumn)[nth];

/** The statement index at `address`, as the debugger's address map answers it. */
const statementAt = (sld: SourceLevelDebugInfo, address: number) => {
  let index = -1;
  for (const [start, i] of sld.addressToStatement) if (start <= address) index = i;
  return index;
};

describe("the .dbg adapter", () => {
  it("passes its own checks on every fixture", () => {
    for (const [name, arch] of [["calls", "zx48k"], ["calls-next", "zxnext"], ["arrays", "zx48k"], ["runtime-error", "zx48k"]]) {
      expect(adapt(name, arch).problems, name).toEqual([]);
    }
  });

  it("re-indexes statements densely in address order (zxbc's have gaps: removed statements)", () => {
    const { sourceLevelDebug: sld } = adapt("calls");
    sld.statements.forEach((s, i) => {
      expect(s.index).toBe(i);
      if (i > 0) expect(s.startAddress).toBeGreaterThan(sld.statements[i - 1].startAddress);
    });
    // --- grid(1, 2) = 42 (line 31): grid is never read, so zxbc removed it with no record
    expect(statementOn(sld, 31)).toBeUndefined();
  });

  it("makes absolute file names", () => {
    const { sourceLevelDebug: sld, sourceFileList } = adapt("calls");
    expect(sld.files).toEqual([{ index: 0, filename: path.join(FIXTURES, "calls", "program.bas") }]);
    expect(sourceFileList).toEqual([{ filename: path.join(FIXTURES, "calls", "program.bas"), includes: [] }]);
  });

  it("clamps statement ends at routine boundaries, so prologues and epilogues are glue", () => {
    const { sourceLevelDebug: sld } = adapt("calls");
    const frames = sld.extensions!.frames;
    const square = sld.callables.find((c) => c.name === "Square")!;
    const fill = sld.callables.find((c) => c.name === "Fill")!;
    // --- RETURN r (Square's last statement) ended in Fill's prologue in zxbc's data
    const ret = statementOn(sld, 12);
    expect(ret.endAddress).toBe(frames[square.index].epilogueStart);
    expect(statementAt(sld, frames[fill.index].startAddress)).toBe(-1);
    expect(statementAt(sld, frames[square.index].epilogueStart)).toBe(-1);
    // --- Twice's only statement repeated its start as its end
    const twice = statementOn(sld, 25);
    expect(twice.endAddress).toBeGreaterThan(twice.startAddress);
  });

  it("maps a dynamic DIM's statement-less code to glue, not to the previous routine", () => {
    const { sourceLevelDebug: sld } = adapt("arrays");
    const dyn = sld.callables.find((c) => c.name === "Dyn")!;
    const frame = sld.extensions!.frames[dyn.index];
    const firstStatement = sld.statements[dyn.firstStatementIndex];
    // --- DIM d(k) runs between the prologue and d(0) = 5: no statement of Fill's may own it
    expect(firstStatement.startAddress - frame.bodyStart).toBeGreaterThan(300);
    expect(statementAt(sld, frame.bodyStart + 10)).toBe(-1);
  });

  it("starts an indented statement at its first character", () => {
    const { sourceLevelDebug: sld, source } = adapt("calls");
    const assignment = statementOn(sld, 11);
    expect(source[10].slice(assignment.startColumn, assignment.endColumn)).toBe("r = n * n");
  });

  it("ends a multi-item PRINT after its last item, before the ':'", () => {
    const { sourceLevelDebug: sld, source } = adapt("calls");
    const first = statementOn(sld, 39, 0);
    const second = statementOn(sld, 39, 1);
    expect(source[38].slice(first.startColumn, first.endColumn)).toBe("PRINT name$; ratio; fx");
    expect(source[38].slice(second.startColumn, second.endColumn)).toBe("PRINT total");
  });

  it("uses the body's first address as a routine's entry, and keeps FASTCALL frameless", () => {
    const { sourceLevelDebug: sld } = adapt("calls");
    const frames = sld.extensions!.frames;
    for (const c of sld.callables) expect(c.entryAddress).toBe(frames[c.index].bodyStart);
    const twice = sld.callables.find((c) => c.name === "Twice")!;
    expect(frames[twice.index].convention).toBe("fastcall");
    expect(frames.find((f) => f.callableIndex === sld.callables.find((c) => c.kind === "entrypoint")!.index)!.convention).toBe("entrypoint");
    expect(frames.length).toBe(sld.callables.length);
  });

  it("gives top-level call sites the entrypoint as caller and remaps their statements", () => {
    const { sourceLevelDebug: sld } = adapt("calls");
    const main = sld.callables.find((c) => c.kind === "entrypoint")!.index;
    const sites = sld.extensions!.callSites;
    expect(sites.map((s) => [s.kind, !!s.returnsValue, !!s.dispatch])).toEqual([
      ["routine", false, false],
      ["routine", true, false],
      ["routine", true, false],
      ["routine", true, false],
      ["local", false, false],
      ["local", false, true]
    ]);
    for (const site of sites) {
      expect(site.callerIndex).toBe(main);
      // --- The site's statement is the one whose code holds the call
      const statement = sld.statements[site.statementIndex];
      expect(site.returnAddress).toBeGreaterThan(statement.startAddress);
      expect(site.returnAddress).toBeLessThanOrEqual(statement.endAddress);
    }
    expect(sites.filter((s) => s.statementIndex === statementOn(sld, 34).index).map((s) => s.moreCallsFollow)).toEqual([true, false]);
  });

  it("moves FUNCTION call sites' return addresses back to the byte after the CALL (zxbc's off-by-one)", () => {
    for (const name of ["calls", "calls-next"]) {
      const { sourceLevelDebug: sld } = adapt(name);
      const bin = fs.readFileSync(path.join(FIXTURES, name, "program.bin"));
      for (const site of sld.extensions!.callSites) expect(bin[site.returnAddress - 3 - 0x8000], `${name} $${site.returnAddress}`).toBe(0xcd);
    }
  });

  it("keeps the variables it can show and leaves out the ones it cannot", () => {
    const calls = adapt("calls");
    const names = calls.sourceLevelDebug.extensions!.variables.map((v) => v.displayName);
    expect(names).toEqual(expect.arrayContaining(["g", "total", "name$", "ratio", "fx", "n", "r", "acc", "arr", "i"]));
    // --- Twice's parameter: FASTCALL has no frame, so its IX offset would read the caller's
    expect(names).not.toContain("v");
    expect(calls.dropped).toEqual(["variable v: in a routine without a frame"]);
    const arr = calls.sourceLevelDebug.extensions!.variables.find((v) => v.name === "arr")!;
    expect(arr).toMatchObject({ kind: "local", location: { at: "frame", ixOffset: -7 }, array: { elementType: "u8", elementLabel: "UByte", layout: "descriptor", dimensions: [{ lower: 0, upper: 9 }] } });
    expect(calls.sourceLevelDebug.extensions!.variables.find((v) => v.name === "acc")).toMatchObject({ byRef: true, type: "i32", typeLabel: "Long" });

    const arrays = adapt("arrays");
    // --- d(k): a dynamic local array, behind a pointer to a heap block of unknown shape
    expect(arrays.dropped).toEqual(["variable d: a dynamic array"]);
    expect(arrays.sourceLevelDebug.extensions!.variables.find((v) => v.name === "grid")!.array!.dimensions).toEqual([
      { lower: 0, upper: 2 },
      { lower: 0, upper: 3 }
    ]);
  });

  it("takes the error routine, runtime symbols and line labels from the map", () => {
    const { sourceLevelDebug: sld } = adapt("calls");
    const ext = sld.extensions!;
    const map = parseMemoryMap(fs.readFileSync(path.join(FIXTURES, "calls", "program.map"), "utf8"));
    expect(ext.errorStop).toEqual({ entry: map.find((e) => e.name === "core.__ERROR")!.address, code: { register: "a" }, reports: "zx-rom" });
    expect(ext.labels!.map((l) => l.name)).toEqual(["1000", "2000"]);
    expect(ext.runtimeSymbols.every((s) => s.name.startsWith("core."))).toBe(true);
    expect(ext.mainBaselineSymbol).toBe(map.find((e) => e.name === "core.__CALL_BACK__")!.address);
  });

  it("builds the classic tables from the statements", () => {
    const { sourceLevelDebug: sld, listFileItems, sourceMap } = adapt("calls");
    expect(listFileItems).toHaveLength(sld.statements.length);
    const s = statementOn(sld, 33);
    expect(sourceMap[s.startAddress]).toEqual({ fileIndex: 0, line: 33, startColumn: 0, endColumn: s.endColumn });
    expect(listFileItems.find((i) => i.address === s.startAddress)).toMatchObject({ lineNumber: 33, codeLength: s.endAddress - s.startAddress });
  });

  it("treats files under the installation's lib/ as the library", () => {
    const { sourceLevelDebug: sld, listFileItems } = adapt("calls", "zx48k", path.join(FIXTURES, "calls"));
    expect(sld.extensions!.libraryFiles).toEqual([0]);
    expect(listFileItems).toEqual([]);
  });

  it("refuses a file in another format", () => {
    expect(() =>
      adaptBorielDebugInfo({ dbg: { format: "x", version: 9 }, map: [], arch: "zx48k", baseFolder: "/", optimizationLevel: 0, readFile: () => undefined })
    ).toThrow(/Unsupported debug file format/);
  });
});

describe("the .dbg adapter on banked builds (--split-modules)", () => {
  /** A banked fixture, with the program found in zxbc's snapshot or .nex as the compiler finds it. */
  function adaptBanked(name: string, arch: "zx128k" | "zxnext"): DbgAdapterOutput {
    const folder = path.join(FIXTURES, name);
    const dbg = JSON.parse(fs.readFileSync(path.join(folder, "program.dbg"), "utf8"));
    const ram =
      arch === "zxnext"
        ? new Map(loadNexFileContents(new Uint8Array(fs.readFileSync(path.join(folder, "program.nex")))).fileInfo!.bankData)
        : parseZ80File(new Uint8Array(fs.readFileSync(path.join(folder, "program.z80")))).ram;
    const parts = extractBankedProgram(ram, 0x8000, programBankIds(dbg.sourceLevelDebug.extensions.codebank, arch), dbg.binaryLength, dbg.binaryChecksum);
    if (typeof parts === "string") throw new Error(parts);
    return adaptBorielDebugInfo({
      dbg,
      map: parseMemoryMap(fs.readFileSync(path.join(folder, "program.map"), "utf8")),
      arch,
      baseFolder: folder,
      optimizationLevel: 1,
      image: { bytes: parts[0].bytes, origin: 0x8000 },
      bankImages: parts.slice(1).map((p) => ({ partition: arch === "zxnext" ? p.bank! * 2 : p.bank!, bytes: p.bytes, origin: 0xc000 })),
      readFile: (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined)
    });
  }

  it("gives a module's statements their routine (zxbc records every one as the main program's)", () => {
    for (const [name, arch] of [["banked-128", "zx128k"], ["banked-next", "zxnext"]] as const) {
      const { sourceLevelDebug: sld, problems } = adaptBanked(name, arch);
      expect(problems, name).toEqual([]);
      const owners = new Set(sld.statements.filter((s) => s.partition !== undefined).map((s) => sld.callables[s.callableIndex].name));
      expect([...owners].sort(), name).toEqual(["Mix", "Peek3", "Sum", "Weigh"]);
      // --- With its owner known, a routine's last statement ends at its epilogue again
      for (const c of sld.callables.filter((c) => c.kind !== "entrypoint")) {
        const frame = sld.extensions!.frames!.find((f) => f.callableIndex === c.index)!;
        const last = sld.statements[c.lastStatementIndex];
        expect(last.endAddress, `${name} ${c.name}`).toBeLessThanOrEqual(frame.epilogueStart);
      }
    }
  });

  it("describes zxbc's far-call helper and shadow stack as a CODEBANK runtime", () => {
    const cb128 = adaptBanked("banked-128", "zx128k").sourceLevelDebug.extensions!.codebank!;
    const map = parseMemoryMap(fs.readFileSync(path.join(FIXTURES, "banked-128", "program.map"), "utf8"));
    const pageStack = map.find((e) => e.name === "core.PAGE_STACK")!.address;
    expect(cb128).toMatchObject({
      window: 0xc000,
      windowSize: 0x4000,
      records: { size: 4, grows: "down", bankOffset: 3, returnOffset: 0, bankMask: 0x07, slotStride: 1 },
      shadowStackPointer: pageStack,
      shadowStack: pageStack
    });
    expect(cb128.banks.find((b) => b.bank === 1)).toEqual({ bank: 1, pages: [1, 1] });
    const cbNext = adaptBanked("banked-next", "zxnext").sourceLevelDebug.extensions!.codebank!;
    expect(cbNext.records).toMatchObject({ grows: "down", bankMask: 0xff });
    expect(cbNext.banks.find((b) => b.bank === 34)).toEqual({ bank: 34, pages: [34, 35] });
    // --- The far return is the helper's own return path, loaded by its LD HL,nn
    expect(cbNext.farReturn).toBeGreaterThan(cbNext.farCall);
  });

  it("moves an in-bank FUNCTION call site's return address back, as for unbanked ones", () => {
    const sld = adaptBanked("banked-next", "zxnext").sourceLevelDebug;
    const raw = JSON.parse(fs.readFileSync(path.join(FIXTURES, "banked-next", "program.dbg"), "utf8")).sourceLevelDebug.extensions.callSites;
    const mix = sld.callables.find((c) => c.name === "Mix")!.index;
    const site = sld.extensions!.callSites!.find((s) => s.calleeIndex === mix)!;
    expect(site.returnAddress).toBe(raw.find((s: any) => s.calleeIndex === mix).returnAddress - 1);
  });
});

describe("the validator", () => {
  it("finds overlapping, out-of-routine and dangling records", () => {
    const { sourceLevelDebug } = adapt("calls");
    const broken = structuredClone(sourceLevelDebug) as any;
    broken.statements[1].startAddress = broken.statements[0].startAddress + 1;
    broken.extensions.callSites[0].statementIndex = 999;
    broken.extensions.frames.pop();
    const problems = validateSourceLevel(broken);
    expect(problems.some((p) => /overlap/.test(p))).toBe(true);
    expect(problems.some((p) => /names statement 999/.test(p))).toBe(true);
    expect(problems.some((p) => /frames for/.test(p))).toBe(true);
  });
});

describe("the memory map", () => {
  it("reads unbanked and banked lines", () => {
    const entries = parseMemoryMap("8000: .core.__START_PROGRAM\n00::C000: ._tiles.pixels\n93AB: .LABEL._1000\n93C7: .LABEL.__LABEL5\nrubbish\n");
    expect(entries).toEqual([
      { name: "core.__START_PROGRAM", address: 0x8000 },
      { name: "_tiles.pixels", address: 0xc000, bank: 0 },
      { name: "LABEL._1000", address: 0x93ab },
      { name: "LABEL.__LABEL5", address: 0x93c7 }
    ]);
    const symbols = mapSymbols(entries);
    expect(symbols.labels).toEqual([{ name: "1000", address: 0x93ab }]);
    expect(symbols.runtimeSymbols).toEqual([{ name: "core.__START_PROGRAM", address: 0x8000 }]);
    expect(symbols.errorEntry).toBeUndefined();
  });
});

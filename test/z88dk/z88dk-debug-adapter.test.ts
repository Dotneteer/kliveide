import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import {
  adaptZ88dkDebugInfo,
  cdbRecords,
  cType,
  decodeCalls,
  z80InstructionLength
} from "@main/z88dk-integration/z88dk-debug-adapter";
import {
  mapValue,
  parseZ88dkMap,
  projectFileTest,
  z88dkLineDebug,
  z88dkLineRecords
} from "@main/z88dk-integration/z88dk-map";

const FIXTURE = path.join(__dirname, "fixtures", "zx-hello");
const symbols = parseZ88dkMap(fs.readFileSync(path.join(FIXTURE, "program.map"), "utf8"));
const image = new Uint8Array(fs.readFileSync(path.join(FIXTURE, "program")));
const isProjectFile = projectFileTest([FIXTURE], "/opt/z88dk");

function adapt() {
  const lineDebug = z88dkLineDebug(z88dkLineRecords(symbols, FIXTURE, isProjectFile));
  const out = adaptZ88dkDebugInfo({ symbols, lineDebug, cwd: FIXTURE, isProjectFile, partitionOf: (b) => b, image, origin: 0x8000 });
  if (!out) throw new Error("no debug info");
  return out;
}

describe("CDB records", () => {
  it("decodes the fixture's functions and variables", () => {
    const { functions, variables } = cdbRecords(symbols);
    expect(functions.get("add")).toEqual({ returnsVoid: false });
    expect(functions.get("main")).toEqual({ returnsVoid: false });
    const ofAdd = variables.filter((v) => v.func === "add").map((v) => [v.name, v.offset, v.typeChain]);
    expect(ofAdd).toEqual(expect.arrayContaining([["a", 6, "SI:S"], ["b", 4, "SI:S"], ["s", -2, "SI:S"]]));
    expect(variables.find((v) => v.name === "counter")).toMatchObject({ scope: "global", typeChain: "SI:S", space: "E" });
    expect(variables.find((v) => v.name === "pt")).toMatchObject({ scope: "global", typeChain: "STpoint:S" });
  });

  it("maps C types to value types and their spelling", () => {
    expect(cType("SI:S")).toEqual({ type: "integer", label: "int" });
    expect(cType("SI:U")).toEqual({ type: "uinteger", label: "unsigned int" });
    expect(cType("SC:S")).toEqual({ type: "char", label: "char" });
    expect(cType("SC:U")).toEqual({ type: "ubyte", label: "unsigned char" });
    expect(cType("SL:U")).toEqual({ type: "ulong", label: "unsigned long" });
    expect(cType("DG,SC:U")).toEqual({ type: "pointer", label: "unsigned char *" });
    expect(cType("DG,STpoint:S")).toEqual({ type: "pointer", label: "struct point *" });
    expect(cType("DG,DG,SC:S")).toEqual({ type: "pointer", label: "char * *" });
    expect(cType("STpoint:S")).toBeUndefined();
    expect(cType("DA12x,SC:S")).toBeUndefined();
    expect(cType("SF:S")).toBeUndefined();
  });
});

describe("instruction decoding", () => {
  const bytes = (...b: number[]) => (a: number) => b[a] ?? 0;
  it("sizes prefixed and unprefixed instructions", () => {
    expect(z80InstructionLength(bytes(0x00), 0)).toBe(1);
    expect(z80InstructionLength(bytes(0x21, 0, 0), 0)).toBe(3);
    expect(z80InstructionLength(bytes(0x3e, 1), 0)).toBe(2);
    expect(z80InstructionLength(bytes(0xcb, 0x47), 0)).toBe(2);
    expect(z80InstructionLength(bytes(0xed, 0x4b, 0, 0), 0)).toBe(4);
    expect(z80InstructionLength(bytes(0xed, 0xb0), 0)).toBe(2);
    expect(z80InstructionLength(bytes(0xdd, 0x21, 0, 0), 0)).toBe(4);
    expect(z80InstructionLength(bytes(0xdd, 0x7e, 5), 0)).toBe(3);
    expect(z80InstructionLength(bytes(0xdd, 0x36, 5, 1), 0)).toBe(4);
    expect(z80InstructionLength(bytes(0xfd, 0xcb, 5, 0x46), 0)).toBe(4);
    expect(z80InstructionLength(bytes(0xdd, 0xe5), 0)).toBe(2);
  });

  it("never takes an operand byte for a call", () => {
    // --- ld hl,$CD00 ; call $1234 ; call nz,$5678
    const code = [0x21, 0x00, 0xcd, 0xcd, 0x34, 0x12, 0xc4, 0x78, 0x56];
    expect(decodeCalls((a) => code[a] ?? 0, 0, code.length)).toEqual([
      { address: 3, length: 3, target: 0x1234 },
      { address: 6, length: 3, target: 0x5678 }
    ]);
  });
});

describe("adaptZ88dkDebugInfo (zx-hello)", () => {
  it("describes the startup code and the two functions", () => {
    const { sourceLevelDebug: sld } = adapt();
    expect(sld.language).toBe("c");
    expect(sld.callables.map((c) => [c.name, c.kind])).toEqual([
      ["(startup)", "entrypoint"],
      ["add", "function"],
      ["main", "function"]
    ]);
    const add = sld.callables[1];
    expect(add.entryAddress).toBe(mapValue(symbols, "_add")! + 3);
    expect(add.exitAddresses).toHaveLength(1);
  });

  it("makes one statement per recorded address, lowest line first", () => {
    const { sourceLevelDebug: sld } = adapt();
    // --- The opening lines (9, 14) sit before `call l_debug_push_frame`: no statement starts there
    expect(sld.statements.map((s) => s.startLine)).toEqual([10, 11, 16, 18]);
    for (const s of sld.statements) expect(s.endAddress).toBeGreaterThan(s.startAddress);
    // --- `    counter = add(3, 4);` is 24 characters long
    expect(sld.statements.find((s) => s.startLine === 16)!.endColumn).toBe(24);
    expect(sld.addressToStatement[0]).toEqual([0, -1]);
  });

  it("finds main's call of add, and the startup code's call of main", () => {
    const { sourceLevelDebug: sld } = adapt();
    const sites = sld.extensions!.callSites;
    const addSite = sites.find((s) => s.calleeIndex === 1)!;
    expect(addSite).toMatchObject({ callerIndex: 2, kind: "function", statementIndex: sld.statements.findIndex((s) => s.startLine === 16) });
    const mainSite = sites.find((s) => s.calleeIndex === 2)!;
    expect(mainSite).toMatchObject({ callerIndex: 0, statementIndex: -1, returnAddress: mapValue(symbols, "__Exit") });
  });

  it("describes the variables it can decode, at their map address or frame offset", () => {
    const { sourceLevelDebug: sld, problems } = adapt();
    const vars = sld.extensions!.variables;
    expect(vars.find((v) => v.name === "counter")).toMatchObject({
      kind: "global",
      type: "integer",
      typeLabel: "int",
      location: { at: "absolute", address: mapValue(symbols, "_counter") }
    });
    expect(vars.filter((v) => v.scope !== "global").map((v) => [v.name, v.kind, (v.location as any).ixOffset])).toEqual(
      expect.arrayContaining([["a", "parameter", 6], ["b", "parameter", 4], ["s", "local", -2]])
    );
    expect(problems.some((p) => p.startsWith("pt:"))).toBe(true);
  });

  it("passes its structural checks", () => {
    expect(adapt().invalid).toEqual([]);
  });

  it("locates frames through sccz80's memory frame pointer", () => {
    const { sourceLevelDebug: sld } = adapt();
    const ext = sld.extensions!;
    expect(ext.framePointerAddress).toBe(mapValue(symbols, "__debug_framepointer"));
    expect(ext.mainBaselineSymbol).toBe(mapValue(symbols, "__restore_sp_onexit")! + 1);
    expect(ext.frames[1]).toMatchObject({ convention: "frame", returnSlotOffset: 4, argBytes: 0, bodyStart: mapValue(symbols, "_add")! + 3 });
    expect(ext.frames[2]).toMatchObject({ convention: "frame", returnSlotOffset: 2 });
  });
});

import { describe, expect, it } from "vitest";
import { BasicIntelService, normalizeBasicPath, wordAt } from "@renderer/appIde/services/BasicIntelService";
import { intelOf } from "./intel-kit";

const ROOT = "/p/main.zxbas";
const SOURCE = `DIM x AS UByte
SUB s(a AS UByte)
  DIM x AS Integer
  x = a
END SUB
x = 1
s(x)
`;

function service(source = SOURCE, files: Record<string, string> = {}) {
  const svc = new BasicIntelService();
  svc.update({ [ROOT]: intelOf(source, files) }, ROOT);
  return svc;
}

const lineOf = (text: string, n: number) => text.split("\n")[n - 1];

describe("BasicIntelService", () => {
  it("finds words and normalises paths", () => {
    expect(wordAt("  x = abc$ + 1", 8)).toEqual({ word: "abc", startColumn: 7, endColumn: 10 });
    expect(wordAt("GOTO 100", 7)).toEqual({ word: "100", startColumn: 6, endColumn: 9 });
    expect(normalizeBasicPath("/<kbasic-stdlib>/attr.bas")).toBe("<kbasic-stdlib>/attr.bas");
    expect(normalizeBasicPath("C:\\Proj\\Main.zxbas")).toBe("c:/proj/main.zxbas");
  });

  it("answers a position with the right scope's symbol", () => {
    const svc = service();
    const local = svc.symbolAt(ROOT, 4, 3, lineOf(SOURCE, 4))!;
    expect(local.symbol).toMatchObject({ name: "x", storage: "local" });
    const global = svc.symbolAt(ROOT, 6, 1, lineOf(SOURCE, 6))!;
    expect(global.symbol).toMatchObject({ name: "x", storage: "global" });
    expect(svc.references(global, true).map((r) => r.line)).toEqual([1, 6, 7]);
    expect(svc.references(global, false).map((r) => r.line)).toEqual([6, 7]);
    expect(svc.definition(local)).toEqual([{ path: ROOT, line: 3, startColumn: 7, endColumn: 8 }]);
  });

  it("lists the symbols visible on a line, locals hiding globals", () => {
    const svc = service();
    const inside = svc.visibleSymbols(ROOT, 4).map((s) => `${s.name}:${s.storage ?? s.kind}`);
    expect(inside).toEqual(["a:param", "x:local", "s:sub"]);
    expect(svc.visibleSymbols(ROOT, 6).map((s) => s.name)).toEqual(["s", "x"]);
  });

  it("a line inserted above: falls back to the scope around the cursor", () => {
    const svc = service();
    const live = "' new line\n" + SOURCE;
    // --- `x = a` is now line 5; the snapshot still has line 4
    const ref = svc.symbolAt(ROOT, 5, 3, lineOf(live, 5))!;
    expect(ref.symbol).toMatchObject({ name: "x", storage: "local" });
    const outside = svc.symbolAt(ROOT, 7, 1, lineOf(live, 7))!;
    expect(outside.symbol).toMatchObject({ name: "x", storage: "global" });
  });

  it("the symbol renamed in the live text: no answer", () => {
    const svc = service();
    const live = SOURCE.replace("x = 1", "y = 1");
    expect(svc.symbolAt(ROOT, 6, 1, lineOf(live, 6))).toBeUndefined();
  });

  it("keeps answering from the last good snapshot while the file has errors", () => {
    const svc = service();
    // --- The broken text never produced a snapshot; the old one still answers unchanged lines
    const broken = SOURCE.replace("x = 1", "x = 1 +");
    expect(svc.symbolAt(ROOT, 7, 3, lineOf(broken, 7))!.symbol.name).toBe("x");
  });

  it("prefers the build root's snapshot and finds the open file's own", () => {
    const svc = new BasicIntelService();
    const lib = "SUB helper()\nEND SUB\n";
    svc.update(
      {
        [ROOT]: intelOf(`#include "lib.zxbas"\nhelper()\n`, { "/p/lib.zxbas": lib }),
        "/p/other.zxbas": intelOf("DIM q AS UByte\n")
      },
      ROOT
    );
    expect(svc.snapshotFor("/p/lib.zxbas")!.rootFile).toBe(ROOT);
    expect(svc.outline("/p/lib.zxbas").map((e) => e.name)).toEqual(["helper"]);
    expect(svc.routineByName("HELPER", "/p/lib.zxbas")).toBeUndefined();
    expect(svc.routineByName("helper", "/p/lib.zxbas")!.symbol.kind).toBe("sub");
  });

  it("finds labels, line numbers and #defines", () => {
    const text = `#define LIMIT 10\n10 PRINT LIMIT\nGOTO done\ndone:\nGOTO 10\n`;
    const svc = service(text);
    expect(svc.symbolAt(ROOT, 3, 7, "GOTO done")!.symbol.kind).toBe("label");
    expect(svc.symbolAt(ROOT, 5, 6, "GOTO 10")!.symbol.kind).toBe("lineNumber");
    expect(svc.defineAt(ROOT, 2, 12, "10 PRINT LIMIT")!.define).toMatchObject({ name: "LIMIT", body: "10" });
  });
});

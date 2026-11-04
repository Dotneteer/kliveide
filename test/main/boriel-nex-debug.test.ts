import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readSourceDebugSidecar } from "@common/utils/source-debug-sidecar";
import { borielDbgPathFor, borielNexDebug } from "@main/boriel-integration/boriel-nex-debug";

// --- A .nex zxbc built outside Klive, with its .dbg (and .map) beside it: the committed fixtures
const FIXTURES = path.resolve(__dirname, "../boriel/fixtures");

describe("Boriel BASIC: debugging a .nex built outside Klive", () => {
  let folder: string;
  const copyFixture = (name: string, files = ["program.nex", "program.dbg", "program.map", "program.bas"]) => {
    for (const file of files) {
      const from = path.join(FIXTURES, name, file);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(folder, file));
    }
    return path.join(folder, "program.nex");
  };
  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-boriel-nex-"));
  });
  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

  it("finds the .dbg by the .nex's name", () => {
    expect(borielDbgPathFor(path.join("a", "game.nex"))).toBe(path.join("a", "game.dbg"));
  });

  for (const fixture of ["calls-next", "language-next", "banked-next"]) {
    it(`turns ${fixture}'s .dbg into a sidecar for its .nex`, () => {
      const nexPath = copyFixture(fixture);
      const result = borielNexDebug(nexPath, "");
      expect(result && "sidecar" in result, JSON.stringify(result)).toBe(true);
      const read = readSourceDebugSidecar((result as { sidecar: string }).sidecar, new Uint8Array(fs.readFileSync(nexPath)));
      if ("error" in read) throw new Error(read.error);
      expect(read.info.statements.length).toBeGreaterThan(0);
      // --- The source files are named relative to the .dbg's folder, so breakpoints in them resolve
      const named = JSON.parse(fs.readFileSync(borielDbgPathFor(nexPath), "utf8")).sourceLevelDebug.files;
      expect(read.program!.sourceFileList.map((f) => f.filename).sort()).toEqual(
        named.map((f: { filename: string }) => path.resolve(folder, f.filename)).sort()
      );
      expect(read.program!.listFileItems.length).toBeGreaterThan(0);
      expect(read.program!.entryAddress).toBeGreaterThanOrEqual(0x8000);
      if (fixture === "banked-next") expect(read.program!.segments.some((s) => s.bank !== undefined)).toBe(true);
    });
  }

  it("refuses a .dbg written for another build of the .nex", () => {
    const nexPath = copyFixture("calls-next");
    const dbg = JSON.parse(fs.readFileSync(borielDbgPathFor(nexPath), "utf8"));
    dbg.binaryChecksum = (dbg.binaryChecksum + 1) >>> 0;
    fs.writeFileSync(borielDbgPathFor(nexPath), JSON.stringify(dbg));
    expect(borielNexDebug(nexPath, "")).toMatchObject({ error: /another build/ });
  });

  it("refuses a .dbg written for another machine", () => {
    const nexPath = copyFixture("calls-next");
    fs.copyFileSync(path.join(FIXTURES, "calls", "program.dbg"), borielDbgPathFor(nexPath));
    expect(borielNexDebug(nexPath, "")).toMatchObject({ error: /zx48k/ });
  });

  it("says nothing when the .nex has no .dbg", () => {
    expect(borielNexDebug(copyFixture("calls-next", ["program.nex"]), "")).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { importRomNames, parseRomNameList, romIdentifierOf } from "@renderer/appIde/annotations/romNameImport";
import { freshRomSidecar } from "@renderer/appIde/annotations/romWorkingCopy";
import { checkRomSidecar } from "@renderer/appIde/annotations/romSidecarCheck";
import { formatRomSidecar } from "@common/roms/romAnnotationTools";
import { romPageIdentity } from "@common/roms/romIdentity";

/*
 * `rom-ann-import-names`: a list of conventional routine names becomes `manual` labels in a ROM's
 * working copy (`.ai/rom-annotations/README.md`, Q1). The names below are invented: the test needs
 * the shapes of names, not anybody's list.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const ZX81 = new Uint8Array(readFileSync(join(ROMS, "zx81.rom")));
const fresh = () =>
  JSON.parse(
    freshRomSidecar({
      workingPath: "x",
      workingPage: 0,
      ...romPageIdentity(ZX81),
      romName: "zx81.rom"
    })
  );

describe("parseRomNameList", () => {
  it("reads NAME ADDRESS lines in any of the usual notations, with comments", () => {
    const list = parseRomNameList("# names\nSTART $0000\nNEXT-ONE 0x0010 ; trailing\nTHIRD 0020h\n\nFOURTH 48\n");
    expect(list.problems).toEqual([]);
    expect(list.entries.map(({ name, address }) => [name, address])).toEqual([
      ["START", 0],
      ["NEXT-ONE", 0x10],
      ["THIRD", 0x20],
      ["FOURTH", 48]
    ]);
  });

  it("reports a line that is not NAME ADDRESS", () => {
    expect(parseRomNameList("START\nA B C\nX $10000").problems).toHaveLength(3);
  });
});

describe("romIdentifierOf", () => {
  it("writes names as identifiers (A10)", () => {
    expect(romIdentifierOf("CL-ALL")).toBe("CL_ALL");
    expect(romIdentifierOf("STK-STO-$")).toBe("STK_STO_STR");
    expect(romIdentifierOf("--A..B--")).toBe("A_B");
  });
});

describe("importRomNames", () => {
  it("adds the names as manual labels, in a file that passes every shipping check", async () => {
    const result = importRomNames(fresh(), 0, ZX81.length, parseRomNameList("START $0000\nPART-TWO $0008").entries);
    expect(result.added).toEqual([
      { name: "START", address: 0 },
      { name: "PART_TWO", address: 8, from: "PART-TWO" }
    ]);
    const written = JSON.parse(result.text!);
    expect(written.banks["0"].localLabels).toEqual([
      { name: "START", value: 0 },
      { name: "PART_TWO", value: 8 }
    ]);
    expect(written.provenance).toEqual({ "0:0:label": "manual", "0:8:label": "manual" });
    expect(result.text).toBe(formatRomSidecar(written));
    expect((await checkRomSidecar(result.text!, () => ZX81)).problems).toEqual([]);
  });

  it("never overwrites, never shortens, and says why it skipped", () => {
    const raw = fresh();
    raw.banks["0"].localLabels = [{ name: "MINE", value: 0 }];
    raw.provenance = { "0:0:label": "observed" };
    const result = importRomNames(
      raw,
      0,
      ZX81.length,
      parseRomNameList(
        "OTHER $0000\nMINE $0010\nA-NAME-FAR-TOO-LONG-HERE $0020\n--- $0030\nBEYOND $2000\nOK $0040\nOK $0050"
      ).entries
    );
    expect(result.added.map((entry) => entry.name)).toEqual(["OK"]);
    expect(result.skipped.map((skip) => [skip.name, skip.reason])).toEqual([
      ["OTHER", "the address already has the label MINE"],
      ["MINE", "MINE is already used at another address"],
      ["A-NAME-FAR-TOO-LONG-HERE", expect.stringContaining("longer than 16 characters")],
      ["---", "nothing of the name is usable in a label"],
      ["BEYOND", "the address is not in this ROM page"],
      ["OK", "OK is already used at another address"]
    ]);
    // --- The author's own label keeps its provenance
    expect(JSON.parse(result.text!).provenance["0:0:label"]).toBe("observed");
  });

  it("writes nothing when nothing is new, so it can be run again", () => {
    const once = importRomNames(fresh(), 0, ZX81.length, parseRomNameList("START $0000").entries);
    const again = importRomNames(JSON.parse(once.text!), 0, ZX81.length, parseRomNameList("START $0000").entries);
    expect(again.text).toBeUndefined();
    expect(again.skipped[0].reason).toBe("already there");
  });
});

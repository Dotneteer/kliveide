import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import type { RawRomSidecar } from "@common/roms/romAnnotationTools";
import { compileAnnotations, type CompileInput } from "@common/reverse/pipeline/postprocess/compile";
import { newRomSidecar } from "@common/reverse/pipeline/postprocess/newSidecar";
import { sidecarPageToAnn } from "@common/reverse/pipeline/postprocess/sidecarToAnn";

/*
 * The postprocessor's core (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §6.1, P1): every shipped sidecar
 * survives sidecar -> .ann -> sidecar byte for byte (D6: nothing is lost, so `.ann` files can stay
 * work files), and the overlay, conflict and provenance rules hold.
 */

const ROMS = join(__dirname, "../../src/public/roms");

function shippedSidecars(dir = ROMS): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return shippedSidecars(path);
    return name.endsWith(".rom.dis") ? [relative(ROMS, path)] : [];
  });
}

/** The page's size: shipped regions cover a page from 0 to its last byte. */
const pageSizeOf = (sidecar: RawRomSidecar, page: string) =>
  Math.max(...sidecar.banks[page].regions.map((r: { end: number }) => r.end)) + 1;

/** The sidecar with one page's annotations removed: what a page looks like before anyone wrote it. */
function withEmptiedPage(sidecar: RawRomSidecar, page: string): RawRomSidecar {
  const copy = structuredClone(sidecar);
  copy.banks[page] = { ...copy.banks[page], regions: [], localLabels: [], lineAnnotations: {} };
  for (const key of Object.keys(copy.provenance ?? {})) if (key.startsWith(`${page}:`)) delete copy.provenance[key];
  return copy;
}

describe("round trip: sidecar -> .ann -> sidecar", () => {
  const sidecars = shippedSidecars();

  it("finds the shipped sidecars", () => {
    expect(sidecars.length).toBeGreaterThan(40);
  });

  it.each(sidecars)("%s comes back byte for byte", (name) => {
    const original = readFileSync(join(ROMS, name), "utf8");
    const sidecar: RawRomSidecar = JSON.parse(original);
    for (const page of Object.keys(sidecar.banks)) {
      const text = sidecarPageToAnn(sidecar, Number(page), { cpu: "z80" });
      const input = (base: RawRomSidecar): CompileInput => ({
        base,
        page: Number(page),
        rom: sidecar.source.fileName,
        cpu: "z80",
        pageSize: pageSizeOf(sidecar, page),
        ann: [{ fileName: `page-${page}.ann`, text }]
      });
      // --- Written onto an emptied page, the .ann file rebuilds it ...
      const rebuilt = compileAnnotations(input(withEmptiedPage(sidecar, page)));
      expect(rebuilt.problems).toEqual([]);
      expect(rebuilt.text).toBe(original);
      // --- ... and laid over the page it came from, it changes nothing
      const overlaid = compileAnnotations(input(sidecar));
      expect(overlaid.problems).toEqual([]);
      expect(overlaid.changes).toEqual([]);
      expect(overlaid.text).toBe(original);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// The overlay rules, on a small page

const SIZE = 0x40;

function smallBase(): RawRomSidecar {
  const sidecar = newRomSidecar("test.rom", [{ page: 0, bytes: new Uint8Array(SIZE), origin: 0 }]);
  sidecar.banks["0"].regions = [
    { start: 0x00, end: 0x1f, type: "disassemble" },
    { start: 0x20, end: 0x3f, type: "bytes", decode: "text" }
  ];
  sidecar.banks["0"].localLabels = [{ name: "START", value: 0x00 }];
  sidecar.banks["0"].lineAnnotations = { "0": { synopsis: "Carried synopsis.", comment: "Carried" } };
  sidecar.provenance = { "0:0:label": "derived", "0:0:line": "derived", "0:32:region": "derived" };
  return sidecar;
}

function compile(...texts: string[]) {
  return compileAnnotations({
    base: smallBase(),
    page: 0,
    rom: "test.rom",
    cpu: "z80",
    pageSize: SIZE,
    ann: texts.map((text, i) => ({ fileName: `f${i}.ann`, text: `rom test.rom page 0 cpu z80\n${text}` }))
  });
}

const errors = (result: ReturnType<typeof compile>) =>
  result.problems.filter((p) => p.severity === "error").map((p) => p.message);

describe("compileAnnotations", () => {
  it("lays new entries over the base and lists the base entries it replaces", () => {
    const result = compile("@0000 RESET\n  New synopsis.\n@0010 LOOP\n  .0011 New comment");
    expect(errors(result)).toEqual([]);
    const bank = result.sidecar.banks["0"];
    expect(bank.localLabels).toEqual([
      { name: "RESET", value: 0 },
      { name: "LOOP", value: 0x10 }
    ]);
    expect(bank.lineAnnotations["0"]).toEqual({ synopsis: "New synopsis.", comment: "Carried" });
    expect(result.changes.map((c) => [c.what, c.before, c.after])).toEqual([
      ["label", "START", "RESET"],
      ["synopsis", "Carried synopsis.", "New synopsis."]
    ]);
    // --- Touched entries take the file's default; the untouched region keeps its own
    expect(result.sidecar.provenance).toEqual({
      "0:0:label": "observed",
      "0:0:line": "observed",
      "0:16:label": "observed",
      "0:17:line": "observed",
      "0:32:region": "derived"
    });
  });

  it("cuts base regions around a new one; a cut-off piece keeps the base region's provenance", () => {
    const result = compile("words 0028-002F");
    expect(errors(result)).toEqual([]);
    expect(result.sidecar.banks["0"].regions).toEqual([
      { start: 0x00, end: 0x1f, type: "disassemble" },
      { start: 0x20, end: 0x27, type: "bytes", decode: "text" },
      { start: 0x28, end: 0x2f, type: "words" },
      { start: 0x30, end: 0x3f, type: "bytes", decode: "text" }
    ]);
    expect(result.sidecar.provenance).toMatchObject({ "0:32:region": "derived", "0:40:region": "observed", "0:48:region": "derived" });
    expect(result.changes).toMatchObject([{ what: "region", before: "text 0020-003F", after: "words 0028-002F" }]);
  });

  it("takes provenance marks, also for base entries it does not change", () => {
    const result = compile("@0010 LOOP\nmanual 0010:label 0020:region");
    expect(result.sidecar.provenance).toMatchObject({ "0:16:label": "manual", "0:32:region": "manual" });
    expect(compile("manual 0030:label").problems).toMatchObject([{ severity: "warning", message: expect.stringMatching(/names no entry/) }]);
  });

  it("deletes base entries", () => {
    const result = compile("delete 0000:label 0000:comment");
    expect(errors(result)).toEqual([]);
    expect(result.sidecar.banks["0"].localLabels).toEqual([]);
    expect(result.sidecar.banks["0"].lineAnnotations["0"]).toEqual({ synopsis: "Carried synopsis." });
    expect(result.sidecar.provenance["0:0:label"]).toBeUndefined();
    expect(compile("delete 0010:synopsis").problems[0]).toMatchObject({ severity: "warning" });
  });

  it("reports files that disagree instead of letting one win", () => {
    expect(errors(compile("@0010 LOOP", "@0010 AGAIN"))).toEqual([expect.stringMatching(/LOOP in f0\.ann/)]);
    expect(errors(compile("@0010 LOOP", "@0018 LOOP"))).toEqual([
      expect.stringMatching(/\$0018 here and \$0010 in f0\.ann/),
      expect.stringMatching(/Label LOOP is on \$0010 and \$0018/)
    ]);
    expect(errors(compile("words 0020-0027", "bytes 0024-002B"))[0]).toMatch(/overlaps 0020-0027 \(f0\.ann\)/);
    expect(errors(compile(".0010 One", ".0010 Two"))[0]).toMatch(/differs from the one in f0\.ann/);
    expect(errors(compile(".0010 One\n.0010 Two"))[0]).toMatch(/Two comments/);
  });

  it("reports a name already used elsewhere in the base", () => {
    expect(errors(compile("@0010 START"))).toEqual([expect.stringMatching(/Label START is on \$0000 and \$0010/)]);
  });

  it("checks the header against the page, the ROM and the CPU (D2)", () => {
    const result = compileAnnotations({
      base: smallBase(),
      page: 0,
      rom: "test.rom",
      cpu: "z80n",
      pageSize: SIZE,
      ann: [{ fileName: "h.ann", text: "rom other.rom page 1 cpu z80\n" }]
    });
    expect(errors(result)).toEqual([
      expect.stringMatching(/for other\.rom/),
      expect.stringMatching(/page 1, not page 0/),
      expect.stringMatching(/cpu z80; the image is z80n/)
    ]);
  });

  it("rejects offsets outside the page and pages left with bytes in no region", () => {
    expect(errors(compile("@0040 PAST"))[0]).toMatch(/outside the page/);
    const empty = smallBase();
    empty.banks["0"].regions = [];
    const result = compileAnnotations({
      base: empty,
      page: 0,
      rom: "test.rom",
      cpu: "z80",
      pageSize: SIZE,
      ann: [{ fileName: "g.ann", text: "rom test.rom page 0 cpu z80\ncode 0000-000F\ncode 0020-003F\n" }]
    });
    expect(errors(result)).toContain("Bytes 0010-001F are in no region");
  });

  it("collects questions and feedback for the report, not the sidecar", () => {
    const result = compile("question 0010 Needs a run\nfeedback listing 0000-0010 Opened the listing");
    expect(result.questions).toMatchObject([{ offset: 0x10, text: "Needs a run", file: "f0.ann" }]);
    expect(result.feedback).toMatchObject([{ kind: "listing", from: 0, to: 0x10 }]);
    expect(result.text).not.toMatch(/Needs a run|Opened the listing/);
  });
});

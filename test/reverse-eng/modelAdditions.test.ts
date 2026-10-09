import { describe, expect, it } from "vitest";
import {
  parseAnnotations,
  sameRegionLayout,
  type ProgramAnnotations
} from "@renderer/appIde/annotations/programAnnotations";
import { formatAnnotations } from "@renderer/appIde/annotations/annotationSidecar";
import {
  withClearedRowAnnotations,
  withEndOfLineComment,
  withLineAnnotation,
  withNamedGraphic,
  withRegion
} from "@renderer/appIde/annotations/annotationEdits";
import { createAnnotatedDisassemblyItems } from "@renderer/appIde/annotations/annotatedDisassembly";

/*
 * The model additions of `.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §3 (M0): `text`/`graphic`
 * decoded regions, `origin`, `graphics`, `endComment` and `interop` — all keys a shipped build
 * ignores (R2).
 */

const SIDECAR = {
  schemaVersion: 3,
  machine: "sp48",
  globalLabels: [],
  banks: {
    "2": {
      offsetIndex: 2,
      regions: [
        { start: 0, end: 15, type: "disassemble", origin: "auto" },
        { start: 16, end: 23, type: "bytes", decode: "text", origin: "skool" },
        { start: 24, end: 39, type: "bytes", rowBytes: 2, decode: "graphic" },
        { start: 40, end: 16383, type: "disassemble" }
      ],
      localLabels: [{ name: "Ship", value: 24 }],
      lineAnnotations: { "0": { comment: "Entry", endComment: "Falls through." } },
      graphics: [{ offset: 24, width: 2, height: 8, count: 1, layout: "linear", label: "Ship" }],
      interop: { skool: { directives: { "0": ["isub=LD A,1"] }, entryPoints: [0] } }
    }
  }
};

/** What a build that predates these keys accepts: four region types, `rowBytes` 1..4, any extra key ignored. */
function shippedBuildAccepts(json: any): boolean {
  for (const bank of Object.values<any>(json.banks)) {
    for (const region of bank.regions) {
      if (!["disassemble", "bytes", "words", "skip"].includes(region.type)) return false;
      if (region.rowBytes !== undefined && (region.rowBytes < 1 || region.rowBytes > 4)) return false;
      if (region.rowBytes !== undefined && region.type !== "bytes") return false;
    }
  }
  return true;
}

describe("model additions", () => {
  const text = `${JSON.stringify(SIDECAR, null, 2)}\n`;
  const parsed = parseAnnotations(text);

  it("loads with no diagnostics and stays readable by shipped builds", () => {
    expect(parsed.diagnostics).toEqual([]);
    expect(shippedBuildAccepts(SIDECAR)).toBe(true);
    const bank = parsed.annotations!.banks["2"];
    expect(bank.regions.map((r) => [r.type, r.origin])).toEqual([
      ["disassemble", "auto"],
      ["text", "skool"],
      ["graphic", undefined],
      ["disassemble", undefined]
    ]);
    expect(bank.graphics).toHaveLength(1);
    expect(bank.lineAnnotations!["0"].endComment).toBe("Falls through.");
    expect(bank.interop!.skool!.entryPoints).toEqual([0]);
  });

  it("round-trips byte for byte", () => {
    expect(formatAnnotations(parsed.annotations!)).toBe(text);
  });

  it("keeps an auto region apart from a user region", () => {
    expect(sameRegionLayout({ type: "bytes" }, { type: "bytes", origin: "auto" })).toBe(false);
    expect(sameRegionLayout({ type: "bytes", origin: "auto" }, { type: "bytes", origin: "auto" })).toBe(true);
    expect(sameRegionLayout({ type: "graphic" }, { type: "graphic" })).toBe(false);
  });

  it("warns, never fails, on a bad graphic or origin", () => {
    const bad = JSON.parse(text);
    bad.banks["2"].graphics.push({ offset: 1, width: 99, height: 1, count: 1, layout: "linear" });
    bad.banks["2"].regions[0].origin = "martian";
    const result = parseAnnotations(JSON.stringify(bad));
    expect(result.annotations).toBeDefined();
    expect(result.diagnostics.every((d) => d.severity === "warning")).toBe(true);
    expect(result.diagnostics).toHaveLength(2);
  });

  it("a user edit takes the region back from detection", () => {
    const edited = withRegion(parsed.annotations!, 2, 0, 3, "bytes")!;
    expect(edited.banks["2"].regions[0]).toEqual({ start: 0, end: 3, type: "bytes" });
    expect(edited.banks["2"].regions[1]).toMatchObject({ start: 4, end: 15, origin: "auto" });
    const auto = withRegion(parsed.annotations!, 2, 0, 3, "bytes", "auto")!;
    expect(auto.banks["2"].regions[0]).toEqual({ start: 0, end: 3, type: "bytes", origin: "auto" });
  });

  it("keeps a line with only an end comment, and drops a graphic with its region", () => {
    const withEnd = withEndOfLineComment(parsed.annotations!, 2, 0, undefined)!;
    expect(withEnd.banks["2"].lineAnnotations!["0"]).toEqual({ endComment: "Falls through." });
    const cleared = withLineAnnotation(withEnd, 2, 0, () => ({}))!;
    expect(cleared.banks["2"].lineAnnotations).toBeUndefined();
    const noGraphic = withClearedRowAnnotations(parsed.annotations!, 2, 24, 39)!;
    expect(noGraphic.banks["2"].graphics).toBeUndefined();
  });

  it("names a graphic in one model: label, region and entry", () => {
    const base = parseAnnotations(text).annotations!;
    const named = withNamedGraphic(base, 2, { offset: 100, width: 1, height: 8, count: 3, layout: "cells", label: "Font" });
    expect("annotations" in named).toBe(true);
    const bank = (named as { annotations: ProgramAnnotations }).annotations.banks["2"];
    expect(bank.localLabels).toContainEqual({ name: "Font", value: 100 });
    expect(bank.regions.find((r) => r.start === 100)).toEqual({ start: 100, end: 123, type: "graphic", rowBytes: 1 });
    expect(bank.graphics!.map((g) => g.label)).toEqual(["Ship", "Font"]);
    expect(withNamedGraphic(base, 2, { offset: 0x3ff0, width: 4, height: 8, count: 1, layout: "linear", label: "Big" })).toEqual({
      error: "The graphic (32 bytes) runs past the end of the bank."
    });
    expect("error" in withNamedGraphic(base, 2, { offset: 0, width: 1, height: 1, count: 1, layout: "linear", label: "9x" })).toBe(true);
  });
});

describe("listing generators", () => {
  const contents = new Uint8Array(0x4000);
  contents.set([0x48, 0x69, 0x21, 0x0d, 0x4f, 0x4b, 0xa1, 0], 16);
  contents.set([0x3c, 0x42, 0x81, 0xff], 24);

  it("lists text and graphic regions", async () => {
    const annotations = parseAnnotations(JSON.stringify(SIDECAR)).annotations!;
    const items = (await createAnnotatedDisassemblyItems({
      annotations,
      bank: 2,
      contents,
      allowExtendedSet: false,
      range: { start: 16, end: 27 }
    }))!;
    const rows = items.filter((i) => !i.isPrefixItem).map((i) => [i.instruction, i.hardComment]);
    expect(rows).toEqual([
      ['.defm "Hi!"', undefined],
      [".defb $0D", undefined],
      ['.defm "OK"', undefined],
      [".defb $A1", '"!" + $80'],
      [".defb $00", undefined],
      [".defb %00111100, %01000010", "..####.. .#....#."],
      [".defb %10000001, %11111111", "#......# ########"]
    ]);
  });
});

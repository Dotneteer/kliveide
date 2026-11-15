import { describe, it, expect } from "vitest";

import { createAnnotatedDisassemblyItems } from "@renderer/appIde/annotations/annotatedDisassembly";
import { goToDefinitionTarget } from "@renderer/appIde/annotations/goToDefinition";
import { findLabelReferences } from "@renderer/appIde/annotations/labelReferences";
import { parseAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import { prepareRomDisassembler } from "@renderer/appIde/annotations/romDecoder";
import {
  absoluteOperandOffsetFor,
  pagedWithOperandLabelResolver,
  romPageLayoutsOf,
  romPageRuns
} from "@renderer/appIde/annotations/romRunNaming";

/*
 * A ROM page whose code runs at more than one address (a Cambridge Z88 OZ bank) names an absolute
 * operand where it runs, and from the pages paged in with it (`romRunNaming.ts`). Modelled on bank $0A:
 * EazyLink from offset 0 runs in segment 2 ($8000), the Filer from $2400 in segment 3 ($E400), and the
 * bank is listed at $8000; page 6 stands in for a page paged in with it in segment 3.
 */

const raw = {
  schemaVersion: 3,
  machine: "rom",
  source: { fileName: "test.rom" },
  pages: {
    "10": {
      crc32: "0",
      name: "bank 10",
      segments: [
        { start: 0, segment: 2 },
        { start: 0x2400, segment: 3 }
      ],
      pagedWith: [{ page: 6 }]
    },
    "6": { crc32: "1", name: "bank 6", segments: [{ start: 0, segment: 3 }] },
    "2": {
      crc32: "2",
      name: "bank 2",
      segments: [
        { start: 0, segment: 0 },
        { start: 0x0800, segment: 0, address: 0 },
        { start: 0x0c00, segment: 0 }
      ]
    }
  },
  banks: {
    "10": {
      offsetIndex: 2,
      regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
      localLabels: [{ name: "FilerTarget", value: 0x2410 }]
    },
    "6": {
      offsetIndex: 3,
      regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
      localLabels: [{ name: "OtherPage", value: 0x1000 }]
    }
  }
};
const annotations = parseAnnotations(JSON.stringify(raw)).annotations!;
const layouts = romPageLayoutsOf(raw)!;

// --- Bank 10's bytes: nops, three calls and a load
const bank10 = new Uint8Array(0x4000);
bank10.set([0xcd, 0x00, 0xd0], 0x0200); // EazyLink: call $D000, not in this bank in segment 3 -> page 6
bank10.set([0x21, 0x00, 0xd0], 0x0300); // EazyLink: ld hl,$D000, a value: not named from page 6
bank10.set([0xcd, 0x10, 0xa4], 0x2500); // Filer: call $A410, not an address of the Filer's run
bank10.set([0xcd, 0x10, 0xe4], 0x2600); // Filer: call $E410, the Filer's own FilerTarget

async function listBank10(withRule: boolean) {
  const items = await createAnnotatedDisassemblyItems({
    annotations,
    bank: 10,
    contents: bank10,
    allowExtendedSet: false,
    prepareDisassembler: (d) => prepareRomDisassembler(d, "z88-oz"),
    ...(withRule
      ? {
          absoluteOperandOffset: absoluteOperandOffsetFor("z88-oz", layouts["10"]),
          otherPageOperandLabelResolver: pagedWithOperandLabelResolver(annotations, "z88-oz", layouts, 10)
        }
      : {})
  });
  const rows = (items ?? []).filter((item) => !item.isPrefixItem);
  return { rows, at: (offset: number) => rows.find((row) => row.address === 0x8000 + offset)! };
}

describe("a ROM page's runs", () => {
  it("are one per segments entry, each at its own origin", () => {
    expect(romPageRuns("z88-oz", raw.pages["10"].segments)).toEqual([
      { start: 0, end: 0x23ff, origin: 0x8000 },
      { start: 0x2400, end: 0x3fff, origin: 0xc000 }
    ]);
    // --- LOWRAM is stored at $0800 and runs at $0000
    expect(romPageRuns("z88-oz", raw.pages["2"].segments)[1]).toEqual({ start: 0x0800, end: 0x0bff, origin: -0x0800 });
  });

  it("resolve an absolute operand where the instruction's run runs, and only into a run at that origin", () => {
    const rule = absoluteOperandOffsetFor("z88-oz", layouts["10"])!;
    expect(rule(0x0100, 0x9000)).toBe(0x8000); // EazyLink's own address
    expect(rule(0x0100, 0xa500)).toBeUndefined(); // the Filer's bytes, not at $A500 while EazyLink runs
    expect(rule(0x2500, 0xe600)).toBe(0xc000); // the Filer's own address
    expect(rule(0x2500, 0xc100)).toBeUndefined(); // EazyLink's bytes, not at $C100 while the Filer runs
    expect(rule(0x0100, 0xd000)).toBeUndefined(); // segment 3 while EazyLink runs: another page

    const lowRam = absoluteOperandOffsetFor("z88-oz", layouts["2"])!;
    expect(lowRam(0x0900, 0x0010)).toBe(-0x0800); // LOWRAM's own code, at its RAM address
    expect(lowRam(0x0900, 0x04b0)).toBeUndefined(); // past LOWRAM: RAM, not the keymap at $04B0
  });

  it("apply to a page with segments only", () => {
    expect(absoluteOperandOffsetFor("z88-oz", undefined)).toBeUndefined();
    expect(absoluteOperandOffsetFor("sp48-basic", {})).toBeUndefined();
    expect(pagedWithOperandLabelResolver(annotations, "z88-oz", layouts, 6)).toBeUndefined();
  });
});

describe("the listing of a page with runs", () => {
  it("names an operand where its run runs, and from the pages paged in with it", async () => {
    const { at } = await listBank10(true);
    expect(at(0x2600).instruction).toBe("call FilerTarget");
    expect(at(0x0200).instruction).toBe("call OtherPage");
    expect(at(0x0200).operandCandidates?.[0].labelOutsideBank).toBe(true);
    // --- An `ld hl,nn` value is as often a number as an address: another page does not name it
    expect(at(0x0300).instruction).toBe("ld hl,$D000");
    // --- $A410 is $2410 at the listing's $8000, but not while the Filer runs
    expect(at(0x2500).instruction).toBe("call LA410");
  });

  it("named them at the listing's own address before (the misnaming the rule corrects)", async () => {
    const { at } = await listBank10(false);
    expect(at(0x2600).instruction).toBe("call LE410");
    expect(at(0x0200).instruction).toBe("call LD000");
    expect(at(0x2500).instruction).toBe("call FilerTarget");
  });

  it("goes to the definition and finds the references the listing printed", async () => {
    const { rows, at } = await listBank10(true);
    expect(goToDefinitionTarget({ annotations, bank: 10, item: at(0x2600), addressOffset: 0x8000 })).toEqual({
      kind: "same-bank",
      label: { name: "FilerTarget", scope: "local", value: 0x2410 },
      address: 0xa410
    });
    // --- A name from another page has no definition in this one
    expect(goToDefinitionTarget({ annotations, bank: 10, item: at(0x0200), addressOffset: 0x8000 })).toEqual({
      kind: "none"
    });
    const references = findLabelReferences(
      annotations,
      10,
      rows,
      { name: "FilerTarget", scope: "local", value: 0x2410 },
      0x8000
    );
    expect(references.map((r) => rows[r.rowIndex].address)).toEqual([0x8000 + 0x2600]);
  });
});

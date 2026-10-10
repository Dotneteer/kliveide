import { describe, expect, it } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { parseSkool } from "@common/reverse/skool/skoolParse";
import { parseCtl } from "@common/reverse/skool/ctlParse";
import {
  applySkoolBank,
  proposeSkoolBank,
  skoolToAnnotations,
  type SkoolSite
} from "@common/reverse/skool/skoolToAnnotations";
import { annotationsToSkool, udgArray } from "@common/reverse/skool/annotationsToSkool";
import type { ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";

/*
 * SkoolKit import and export (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §6, §8 G7.5). The fixtures
 * are written for these tests (R7, R8). The round trip skool -> annotations -> skool is identical
 * for a Klive-style file, modulo the documented normalisations.
 */

const BASE = 0x8000;

function memory(): Uint8Array {
  const bytes = new Uint8Array(0x4000);
  bytes.set([0x3e, 0x07, 0xd3, 0xfe, 0x10, 0xfe, 0xc9], 0); // LD A,7 / OUT ($FE),A / DJNZ / RET
  bytes.set([0x48, 0x69, 0x20, 0x74, 0x68, 0x65, 0x72, 0x65, 0x0d], 7); // "Hi there" + CR
  bytes.set([1, 2, 3, 4, 5, 6, 7, 8], 16);
  return bytes;
}

const siteOf = (address: number): SkoolSite | undefined =>
  address >= BASE && address < BASE + 0x4000 ? { bank: 2, offset: address - BASE } : undefined;

async function assemble(lines: { text: string; address: number }[]) {
  const results = [];
  for (const line of lines) {
    const output = await new Z80Assembler().compile(`  .org ${line.address}\n  ${line.text}\n`, new AssemblerOptions());
    results.push(
      output.errorCount ? { error: output.errors[0].message } : { bytes: output.segments.flatMap((s) => s.emittedCode) }
    );
  }
  return results;
}

/** Instruction lines in the exporter's layout. */
const row = (marker: string, address: number, text: string, comment?: string) => {
  const body = `${marker}${address} ${text}`;
  return comment ? `${body.padEnd(25)} ; ${comment}` : body;
};

const SKOOL = [
  "@org=32768",
  "; Draw the frame",
  ";",
  "; Draws the border around the play area.",
  "; .",
  "; Called once per level.",
  ";",
  "; I:A Border colour",
  "; O:HL Address of the frame",
  ";",
  "; First we set things up.",
  "@label=FRAME",
  row("c", 32768, "LD A,$07", "{Set the colour and write it"),
  row(" ", 32770, "OUT ($FE),A", "}"),
  "; Now the loop.",
  "@label=LOOP",
  "@isub=DJNZ 32772",
  row("*", 32772, "DJNZ $8004", "Wait for B"),
  row(" ", 32774, "RET"),
  "; The routine ends here.",
  "; .",
  "; Really.",
  "",
  "; Message text",
  row("t", 32775, 'DEFM "Hi there"'),
  row(" ", 32783, "DEFB $0D"),
  "",
  "; Data",
  row("s", 32784, "DEFB $01,$02,$03,$04"),
  row(" ", 32788, "DEFB $05,$06,$07,$08"),
  "",
  "i32792",
  ""
].join("\n");

async function importInto(source: string, format: "skool" | "ctl", bytes = memory()) {
  const doc = format === "skool" ? parseSkool(source) : parseCtl(source);
  const result = await skoolToAnnotations({ doc, siteOf, bankBytes: async () => bytes, assemble });
  let annotations: ProgramAnnotations = { schemaVersion: 3, machine: "sp48", globalLabels: [], banks: {} };
  for (const bank of result.banks) {
    annotations = applySkoolBank(annotations, bank, proposeSkoolBank(bank, annotations.banks[String(bank.bank)], "fill"), () => 2);
  }
  return { annotations, result };
}

describe("skool import", () => {
  it("maps blocks, entries, comments, labels and the passthrough", async () => {
    const { annotations, result } = await importInto(SKOOL, "skool");
    expect(result.problems).toEqual([]);
    const bank = annotations.banks["2"];
    // --- Code over the default gap is no change (as with detection), so it carries no origin
    expect(bank.regions.map((r) => [r.start, r.end, r.type, r.origin])).toEqual([
      [0, 6, "disassemble", undefined],
      [7, 14, "text", "skool"],
      [15, 23, "bytes", "skool"],
      [24, 24, "skip", "skool"],
      [25, 0x3fff, "disassemble", undefined]
    ]);
    expect(bank.localLabels).toEqual([
      { name: "FRAME", value: 0 },
      { name: "LOOP", value: 4 }
    ]);
    expect(bank.lineAnnotations!["0"]).toEqual({
      synopsis:
        "Draw the frame\n\nDraws the border around the play area.\n\nCalled once per level.\n\nI:A Border colour\nO:HL Address of the frame\n\nFirst we set things up.",
      comment: "Set the colour and write it"
    });
    expect(bank.lineAnnotations!["4"]).toEqual({ synopsis: "Now the loop.", comment: "Wait for B" });
    expect(bank.lineAnnotations!["6"]).toEqual({ endComment: "The routine ends here.\n\nReally." });
    expect(bank.interop!.skool).toMatchObject({
      braces: { "0": 2 },
      entryPoints: [4],
      directives: { "4": ["isub=DJNZ 32772"] },
      entryDirectives: { "0": ["org=32768"] },
      blocks: { "16": "s" }
    });
  });

  it("refuses an entry's regions when its instructions do not match the bytes (S-T2)", async () => {
    const bytes = memory();
    bytes[7] = 0x00;
    const { annotations, result } = await importInto(SKOOL, "skool", bytes);
    expect(result.problems[0].message).toMatch(/DEFM "Hi there" does not match the bytes at \$8007/);
    expect(result.banks[0].mismatchedEntries).toBe(1);
    // --- The message entry stays code; the entries around it came in
    expect(annotations.banks["2"].regions.map((r) => [r.start, r.end, r.type])).toEqual([
      [0, 15, "disassemble"],
      [16, 23, "bytes"],
      [24, 24, "skip"],
      [25, 0x3fff, "disassemble"]
    ]);
    // --- Its title still came in
    expect(annotations.banks["2"].lineAnnotations!["7"].synopsis).toBe("Message text");
  });

  it("renames labels that differ only in case (S-T5)", async () => {
    const source = ["@label=Loop", "c32768 LD A,$07", "@label=LOOP", " 32770 OUT ($FE),A", ""].join("\n");
    const { annotations, result } = await importInto(source, "skool");
    expect(result.renamed).toEqual([{ from: "LOOP", to: "LOOP_2" }]);
    expect(annotations.banks["2"].localLabels!.map((l) => l.name)).toEqual(["Loop", "LOOP_2"]);
  });

  it("switches the bank at $C000 with @bank (S-T1)", async () => {
    const doc = parseSkool(["@bank=3", "c49152 RET", ""].join("\n"));
    const sites: SkoolSite[] = [];
    await skoolToAnnotations({
      doc,
      siteOf: (address, bank) => {
        const site = { bank: address >= 0xc000 ? (bank ?? 0) : 5, offset: address & 0x3fff };
        sites.push(site);
        return site;
      },
      bankBytes: async () => new Uint8Array(0x4000).fill(0xc9),
      assemble
    });
    expect(sites[0]).toEqual({ bank: 3, offset: 0 });
  });
});

describe("skool round trip", () => {
  it("skool -> annotations -> skool is identical", async () => {
    const { annotations } = await importInto(SKOOL, "skool");
    const out = await annotationsToSkool({
      annotations,
      bank: 2,
      bytes: memory(),
      listingBase: BASE,
      range: { start: 0, end: 24 },
      z80n: false,
      format: "skool"
    });
    expect(out).toBe(SKOOL);
  });

  it("export -> import gives the same annotations", async () => {
    const { annotations } = await importInto(SKOOL, "skool");
    const exported = await annotationsToSkool({
      annotations,
      bank: 2,
      bytes: memory(),
      listingBase: BASE,
      range: { start: 0, end: 24 },
      z80n: false,
      format: "skool"
    });
    const again = await importInto(exported, "skool");
    expect(again.annotations).toEqual(annotations);
  });

  it("writes a Klive-authored bank with entries at region boundaries and synopses", async () => {
    const annotations: ProgramAnnotations = {
      schemaVersion: 3,
      machine: "sp48",
      globalLabels: [],
      banks: {
        "2": {
          offsetIndex: 2,
          regions: [
            { start: 0, end: 6, type: "disassemble" },
            { start: 7, end: 15, type: "text" },
            { start: 16, end: 0x3fff, type: "bytes" }
          ],
          localLabels: [{ name: "Start", value: 0 }],
          lineAnnotations: { "0": { synopsis: "Start here\n\nSets the border.", comment: "red" } }
        }
      }
    };
    const out = await annotationsToSkool({
      annotations,
      bank: 2,
      bytes: memory(),
      listingBase: BASE,
      range: { start: 0, end: 19 },
      z80n: false,
      format: "skool",
      org: true
    });
    expect(out).toBe(
      [
        "@org=32768",
        "; Start here",
        ";",
        "; Sets the border.",
        "@label=Start",
        row("c", 32768, "LD A,$07", "red"),
        row(" ", 32770, "OUT ($FE),A"),
        row(" ", 32772, "DJNZ $8004"),
        row(" ", 32774, "RET"),
        "",
        row("t", 32775, 'DEFM "Hi there"'),
        row(" ", 32783, "DEFB $0D"),
        "",
        row("b", 32784, "DEFB $01,$02,$03,$04"),
        ""
      ].join("\n")
    );
  });
});

describe("control files", () => {
  it("exports and imports a ctl file, checked by length only", async () => {
    const { annotations } = await importInto(SKOOL, "skool");
    const ctl = await annotationsToSkool({
      annotations,
      bank: 2,
      bytes: memory(),
      listingBase: BASE,
      range: { start: 0, end: 24 },
      z80n: false,
      format: "ctl"
    });
    expect(ctl).toContain("c 32768 Draw the frame");
    expect(ctl).toContain("D 32768 Draws the border around the play area.");
    expect(ctl).toContain("R 32768 I:A Border colour");
    expect(ctl).toContain("N 32768 First we set things up.");
    expect(ctl).toContain("@ 32768 label=FRAME");
    expect(ctl).toContain("E 32768 The routine ends here.");
    expect(ctl).toContain("t 32775 Message text");
    const again = await importInto(ctl, "ctl");
    const bank = again.annotations.banks["2"];
    expect(bank.regions.slice(0, 3).map((r) => [r.start, r.end, r.type])).toEqual([
      [0, 6, "disassemble"],
      [7, 14, "text"],
      [15, 23, "bytes"]
    ]);
    expect(bank.localLabels!.map((l) => l.name)).toEqual(["FRAME", "LOOP"]);
    expect(bank.lineAnnotations!["0"].synopsis).toBe(annotations.banks["2"].lineAnnotations!["0"].synopsis);
  });
});

describe("#UDGARRAY", () => {
  it("draws cells and row-major graphics", () => {
    expect(udgArray({ offset: 0, width: 2, height: 8, count: 1, layout: "cells", label: "Ship" }, 0x8000)).toBe(
      "#UDGARRAY2;32768-32783-8(Ship)"
    );
    expect(udgArray({ offset: 0, width: 2, height: 16, count: 1, layout: "linear", label: "Man" }, 0x8000)).toBe(
      "#UDGARRAY2,,,2;32768;32769;32784;32785(Man)"
    );
  });
});

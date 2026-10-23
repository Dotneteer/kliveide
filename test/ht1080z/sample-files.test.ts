import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ht1080zCharsFor } from "@common/machines/char-codes";
import { analyzeHt1080zFile, fitsSixteenK } from "@renderer/appIde/DocumentPanels/Ht1080zTape/ht1080zTapeView";
import { ht1080zLineText } from "@renderer/appIde/DocumentPanels/Ht1080zTape/ht1080zLineText";

/*
 * The HT-1080Z tape viewer's model on real software from the HT-1080Z archive at ht.homeserver.hu
 * (`test/testfiles/ht1080z/README.md`): the tapes the machines' owners actually loaded, which nobody
 * here wrote, so they exercise the reader beyond the programs Klive makes itself.
 */
const DIR = join(__dirname, "../testfiles/ht1080z");
const load = (name: string) => analyzeHt1080zFile(new Uint8Array(readFileSync(join(DIR, name))), name);

describe("HT-1080Z sample files", () => {
  it("reads GALAXY as a SYSTEM tape of 37 load blocks", () => {
    const { analysis } = load("galaxy.cas");
    expect(analysis).toMatchObject({ kind: "systemTape", name: "GALAXY", codeBytes: 9472, entry: 0x7fb0, hasProblems: false });
    const blocks = analysis!.parts.filter((p) => p.role === "systemBlock");
    expect(blocks).toHaveLength(37);
    expect(blocks[0].loadFrom).toBe(0x5b00);
    expect(blocks.every((b) => b.checksum!.stored === b.checksum!.computed)).toBe(true);
    expect(fitsSixteenK(analysis!)).toBe(true);
    // --- About two and a half minutes at 500 baud
    expect(analysis!.playMs).toBeGreaterThan(150_000);
    expect(analysis!.playMs).toBeLessThan(170_000);
  });

  it("reads the GALAXY loader, whose first blocks draw its title screen", () => {
    const { analysis } = load("galaxyld.cas");
    expect(analysis).toMatchObject({ kind: "systemTape", name: "GALAXY", entry: 0x7fd4, hasProblems: false });
    const froms = analysis!.parts.filter((p) => p.role === "systemBlock").map((p) => p.loadFrom);
    expect(froms.slice(0, 5)).toEqual([0x41e2, 0x3c00, 0x3d00, 0x3e00, 0x3f00]);
  });

  it("reads two BASIC tapes and lists their lines", () => {
    const amoeba = load("amoeba.cas").analysis!;
    expect(amoeba).toMatchObject({ kind: "basicTape", name: "A", hasProblems: false });
    expect(amoeba.lines).toHaveLength(30);
    expect([amoeba.lines![0].lineNo, amoeba.lines!.at(-1)!.lineNo]).toEqual([10, 310]);
    expect(ht1080zLineText(amoeba.lines![0].text, ht1080zCharsFor("s2")).length).toBeGreaterThan(0);

    const nim = load("android-nim.cas").analysis!;
    expect(nim).toMatchObject({ kind: "basicTape", hasProblems: false });
    expect(nim.lines).toHaveLength(329);
    expect([nim.lines![0].lineNo, nim.lines!.at(-1)!.lineNo]).toEqual([1, 10090]);
    expect(fitsSixteenK(nim)).toBe(true);
  });

  it("reads a .cmd of seven load blocks and its transfer address", () => {
    const { analysis } = load("auto1.cmd");
    expect(analysis).toMatchObject({ kind: "cmd", codeBytes: 1792, entry: 0x7000, loadTop: 0x7700, hasProblems: false });
    expect(analysis!.parts.map((p) => p.role)).toEqual([...new Array(7).fill("cmdLoad"), "cmdTransfer"]);
  });
});

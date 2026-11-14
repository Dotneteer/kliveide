import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";

import { readHardDiskFile } from "@main/hard-disk-images";
import { fwModuleTexts, parseFwFile, readFwTestCard } from "@common/zxnext/fwFile";

/*
 * The real TBBLUE.FW on Klive's committed SD cards (`dev/plans/TBBLUE_FW_VIEWER_PLAN.md` §1a): firmware
 * 1.44 (KS2 card), 1.45 (2.10 card) and 1.46 (26.11 card), read through the same FAT code the viewer's
 * menu item uses. `FW_REAL_FILES` (paths, platform delimiter) checks other files too, never in CI.
 */

const MMC = join(__dirname, "../../src/public/mmc");
const fwOf = (card: string) => readHardDiskFile(join(MMC, card), "TBBLUE.FW");

const NAMED = ["boot", "editorOld", "updater", "coresOld", "editor", "cores", "testCard", "reset", "screens"];

describe("TBBLUE.FW on the committed cards", () => {
  it.each([
    ["ks2-base.cim", "1.44", 304640, 9],
    ["nextzxos-2.10-base.cim", "1.45", 286720, 9],
    ["nextzxos-26.11-base.cim", "1.46", 635904, 17]
  ])("%s holds firmware %s", (card, version, size, count) => {
    const data = fwOf(card);
    const fw = parseFwFile(data);
    expect(fw.format).toBe("firmware");
    expect(fw.fileSize).toBe(size);
    expect(fw.version).toBe(version);
    expect(fw.layout).toBe("current");
    expect(fw.problems).toEqual([]);
    expect(fw.modulesEnd).toBe(size);
    expect(fw.entries).toHaveLength(count);
    expect(fw.entries.slice(0, 9).map((e) => e.name)).toEqual(NAMED);
    expect(fw.entries.map((e) => e.aliasOf).slice(0, 4)).toEqual([undefined, 0, undefined, 0]);
    // --- Every named module but the screens is code, run at $6000
    expect(fw.entries.slice(0, 8).every((e) => e.kind === "code" && e.runsAt === 0x6000)).toBe(true);
    expect(fw.entries[8].kind).toBe("data");
    expect(fwModuleTexts(data, fw.entries[2]).join("|")).toMatch(/Updater/);
  });

  it("1.46's unnamed entries are code or data, told by their texts", () => {
    const data = fwOf("nextzxos-26.11-base.cim");
    const fw = parseFwFile(data);
    const extra = fw.entries.slice(9);
    expect(extra.map((e) => e.name)).toEqual(new Array(8).fill(undefined));
    expect(extra.map((e) => e.kind)).toEqual(["code", "code", "code", "code", "data", "code", "code", "data"]);
    expect(fwModuleTexts(data, fw.entries[9])).toContain("Flash core");
    expect(fwModuleTexts(data, fw.entries[13]).join("|")).toMatch(/The Creators/);
  });

  it("the screens block's picture is the test card, with its 113 colours", () => {
    const data = fwOf("nextzxos-26.11-base.cim");
    const fw = parseFwFile(data);
    const card = readFwTestCard(data, fw.entries[8])!;
    expect(new Set(card.pixels).size).toBe(113);
    expect(card.palette).toContain(0x1ff);
    expect(card.palette).toContain(0);
    // --- The test card's left edge starts red at the top (9-bit RRRGGGBBB $1C0)
    expect(card.palette[card.pixels[0]]).toBe(0x1c0);
  });
});

const realFiles = (process.env.FW_REAL_FILES ?? "").split(delimiter).filter(Boolean);

describe.skipIf(realFiles.length === 0)("real TBBLUE.FW files (FW_REAL_FILES)", () => {
  it.each(realFiles)("%s reads without errors", (path) => {
    expect(existsSync(path)).toBe(true);
    const fw = parseFwFile(new Uint8Array(readFileSync(path)));
    expect(fw.format).toBe("firmware");
    expect(fw.problems.filter((p) => p.severity === "error")).toEqual([]);
  });
});

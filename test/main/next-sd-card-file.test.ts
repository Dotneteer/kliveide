import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseTbuFile } from "@common/zxnext/tbuFile";
import { parseFwFile } from "@common/zxnext/fwFile";

/*
 * Reading a file from the ZX Spectrum Next's current SD card (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`,
 * Phase 5): the card the machine uses, the model's base image before the working copy exists, and
 * the three errors. The happy path reads TBBLUE.TBU from the committed 26.11 base card, so it also
 * checks the whole System/Next 26.11a update file against the TBU reader.
 */

const MMC = path.join(__dirname, "../../src/public/mmc");
const CARD_2611 = path.join(MMC, "nextzxos-26.11-base.cim");

const cards = { active: "", workingCopy: "", baseImage: "" };
vi.mock("@main/machine-menus/zx-next-menus", () => ({
  activeSdCardFile: () => cards.active,
  defaultSdCardOf: () => ({ workingCopy: cards.workingCopy, baseImage: cards.baseImage })
}));

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-sd-file-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

async function read(name = "TBBLUE.TBU") {
  const { readNextSdCardFile } = await import("@main/next-sd-card-file");
  return readNextSdCardFile(name);
}

describe("readNextSdCardFile", () => {
  it("reads TBBLUE.TBU from the card the machine uses (the 26.11 card)", async () => {
    Object.assign(cards, { active: CARD_2611, workingCopy: path.join(dir, "ks3.cim"), baseImage: CARD_2611 });
    const result = await read();
    expect(result.card).toBe(CARD_2611);
    expect(result.error).toBeUndefined();
    const tbu = parseTbuFile(result.contents!);
    // --- System/Next 26.11a: seven records, every image intact (§1a of the plan)
    expect(tbu.format).toBe("multi");
    expect(tbu.records.map((r) => r.boardByte)).toEqual([0x20, 0x02, 0x03, 0x10, 0x00, 0x40, 0x41]);
    expect(tbu.records.map((r) => r.version)).toEqual(["3.03.03", "3.03.03", "3.03.03", "3.03.03", "3.03.03", "3.02.04", "3.02.04"]);
    expect(tbu.fileSize).toBe(5839872);
    expect(tbu.problems).toEqual([]);
    expect(tbu.records.map((r) => r.bitstream?.part)).toEqual([
      "XC6SLX16", "XC7A15T", "XC7A35T", "XC6SLX16", "XC6SLX16", "XC6SLX16", "XC6SLX16"
    ]);
  });

  it("reads TBBLUE.FW from the same card", async () => {
    Object.assign(cards, { active: CARD_2611, workingCopy: path.join(dir, "ks3.cim"), baseImage: CARD_2611 });
    const result = await read("TBBLUE.FW");
    expect(result.error).toBeUndefined();
    expect(parseFwFile(result.contents!).version).toBe("1.46");
  });

  it("reads the model's base image while its working copy does not exist yet", async () => {
    const workingCopy = path.join(dir, "ks2.cim");
    Object.assign(cards, { active: workingCopy, workingCopy, baseImage: path.join(MMC, "ks2-base.cim") });
    const result = await read();
    expect(result.card).toBe(cards.baseImage);
    expect(parseTbuFile(result.contents!).format).toBe("multi");
  });

  it("says when a selected card image is missing", async () => {
    const missing = path.join(dir, "gone.cim");
    Object.assign(cards, { active: missing, workingCopy: path.join(dir, "ks2.cim"), baseImage: CARD_2611 });
    expect(await read()).toEqual({ card: missing, error: "noCard" });
  });

  it("says when the card has no such file", async () => {
    const { createHardDiskImage } = await import("@main/hard-disk-images");
    const card = path.join(dir, "empty.img");
    createHardDiskImage(card, { sizeMb: 16, fatType: "fat16" });
    Object.assign(cards, { active: card, workingCopy: path.join(dir, "ks2.cim"), baseImage: CARD_2611 });
    expect(await read()).toEqual({ card, error: "notFound" });
  });

  it("says when the card cannot be read", async () => {
    const card = path.join(dir, "junk.img");
    fs.writeFileSync(card, new Uint8Array(64 * 1024).fill(0x5a));
    Object.assign(cards, { active: card, workingCopy: path.join(dir, "ks2.cim"), baseImage: CARD_2611 });
    const result = await read();
    expect(result.error).toBe("unreadable");
    expect(result.message).toBeTruthy();
  });
});

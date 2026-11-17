import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { MemoryBlockDevice } from "@common/diskfs/blockDevice";
import { FatFileSystem, createFatImage } from "@common/diskfs/fat";
import type { NextRomSetId } from "@common/zxnext/romSets";
import { checkNextSdCard } from "@main/next-sd/checkNextSdCard";

/*
 * The SD card integrity check (`dev/plans/NEXT_SD_CARDS_PLAN.md` D-8) on small cards made with Klive's
 * own FAT code: a good one, and one for each way a card fails. `next-sd-check-real.test.ts` runs it on
 * the real base cards.
 */

const ROMS = path.join(__dirname, "../../src/public/roms/zxnext");
const altRom = (setId: NextRomSetId) => new Uint8Array(fs.readFileSync(path.join(ROMS, setId, "enAltZX.rom")));

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-sd-check-"));
});
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const CARD_MB = 64;
const CLUSTER = 0x1_0000;

/**
 * A FAT32 card with the given files on it, built in memory (writing through `CimHandler` syncs every
 * sector and takes seconds a card): a raw `.img`, or a `.cim` with one 64K cluster per non-empty
 * stretch, in the layout `CimFileManager` writes.
 */
function makeCard(name: string, files: Record<string, Uint8Array>): string {
  const image = createFatImage(CARD_MB * 1024 * 1024, { type: 32, partitioned: true });
  const fat = FatFileSystem.open(new MemoryBlockDevice(image));
  for (const [target, data] of Object.entries(files)) {
    const folder = target.substring(0, target.lastIndexOf("/"));
    if (folder) fat.mkdir(folder);
    fat.write({ name: target, kind: "raw", data });
  }
  const file = path.join(dir, name);
  if (!name.endsWith(".cim")) {
    fs.writeFileSync(file, image);
    return file;
  }
  const header = Buffer.alloc(CLUSTER);
  header.write("CIMF", 0, "latin1");
  header[4] = 1; // --- version 1.0
  header[6] = 1; // --- 512-byte sectors
  header.writeUInt16LE((CARD_MB * 1024) / 64, 7); // --- clusters of the card
  header[9] = 1; // --- 64K clusters
  header.writeUInt16LE(CARD_MB, 12);
  const clusters: Buffer[] = [];
  for (let i = 0; i < (CARD_MB * 1024 * 1024) / CLUSTER; i++) {
    const cluster = image.subarray(i * CLUSTER, (i + 1) * CLUSTER);
    let used = false;
    for (let b = 0; b < cluster.length && !used; b++) used = cluster[b] !== 0;
    header.writeUInt16LE(used ? clusters.length : 0xffff, 0x10 + i * 2);
    if (used) clusters.push(Buffer.from(cluster));
  }
  fs.writeFileSync(file, Buffer.concat([header, ...clusters]));
  return file;
}

const systemFiles = (setId: NextRomSetId) => ({
  "machines/next/enAltZX.rom": altRom(setId),
  "nextzxos/enSystem.sys": new Uint8Array(1000).fill(0xc9)
});

describe("checkNextSdCard", () => {
  it("passes a card with the model's NextZXOS release", () => {
    const card = makeCard("good.cim", systemFiles("nextzxos-26.11"));
    expect(checkNextSdCard(card, "ks3-30303")).toEqual({ status: "ok", file: card });
    expect(checkNextSdCard(card, "ks2-30303").status).toBe("ok");
  });

  it("passes a raw .img card too", () => {
    const card = makeCard("good.img", systemFiles("nextzxos-2.10"));
    expect(checkNextSdCard(card, "ks2-30204").status).toBe("ok");
  });

  it("names a card of another release, and the release it is", () => {
    const card = makeCard("old.cim", systemFiles("nextzxos-2.08"));
    expect(checkNextSdCard(card, "ks3-30303")).toEqual({
      status: "wrongRelease",
      file: card,
      expected: "nextzxos-26.11",
      found: "nextzxos-2.08"
    });
  });

  it("reports a release Klive does not know without naming one", () => {
    const card = makeCard("unknown.cim", {
      ...systemFiles("nextzxos-26.11"),
      "machines/next/enAltZX.rom": new Uint8Array(32768).fill(0x76)
    });
    const result = checkNextSdCard(card, "ks3-30303");
    expect(result).toMatchObject({ status: "wrongRelease", expected: "nextzxos-26.11" });
    expect(result.status === "wrongRelease" && result.found).toBeUndefined();
  });

  it("reports a missing file", () => {
    const card = path.join(dir, "nowhere.cim");
    expect(checkNextSdCard(card, "ks3-30303")).toEqual({ status: "missing", file: card });
    expect(checkNextSdCard(dir, "ks3-30303").status).toBe("missing");
  });

  it("reports a file that is not a CIM image", () => {
    const card = path.join(dir, "text.cim");
    fs.writeFileSync(card, new Uint8Array(0x20000).fill(0x41));
    expect(checkNextSdCard(card, "ks3-30303")).toMatchObject({ status: "unreadable", message: "The file is not a CIM image." });
  });

  it("reports a CIM card cut short", () => {
    const good = makeCard("cut-source.cim", systemFiles("nextzxos-26.11"));
    const card = path.join(dir, "cut.cim");
    fs.copyFileSync(good, card);
    fs.truncateSync(card, fs.statSync(card).size - 0x1_0000);
    const result = checkNextSdCard(card, "ks3-30303");
    expect(result.status).toBe("unreadable");
    expect(result.status === "unreadable" && result.message).toContain("incomplete");
  });

  it("reports a card with no volume NextZXOS could mount", () => {
    const card = path.join(dir, "blank.img");
    fs.writeFileSync(card, new Uint8Array(1024 * 1024));
    expect(checkNextSdCard(card, "ks3-30303").status).toBe("noPartition");
  });

  it("lists the system files a card lacks", () => {
    const card = makeCard("empty.cim", { "readme.txt": new Uint8Array(10) });
    expect(checkNextSdCard(card, "ks3-30303")).toEqual({
      status: "noSystemFiles",
      file: card,
      missing: ["machines/next/enAltZX.rom", "nextzxos/enSystem.sys"]
    });
  });
});

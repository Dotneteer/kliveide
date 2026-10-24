import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import {
  createHardDiskImage,
  editHardDisk,
  queryHardDisk,
  readHardDiskFile
} from "@main/hard-disk-images";

/*
 * Hard-disk images in the main process (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C1/C2): each
 * container made, formatted, edited and read back through its block device.
 */

const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);

describe.each([
  ["card.img", 16, 32],
  ["card.hdf", 16, 32],
  ["card.cim", 32, 64]
] as const)("%s", (name, fatType, sizeMb) => {
  it(`is made as FAT${fatType}, edited and read back`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-hdd-"));
    const file = path.join(dir, name);
    createHardDiskImage(file, { sizeMb, fatType: fatType as 16 | 32, label: "CARD" });
    let view = queryHardDisk(file);
    expect(view).toMatchObject({ kind: name.slice(-3), files: [], info: { system: `FAT${fatType}`, label: "CARD" } });
    expect(view.partitions.length).toBe(1);

    editHardDisk(file, { kind: "mkdir", path: "GAMES" });
    editHardDisk(file, { kind: "add", files: [{ name: "GAMES/Manic Miner.tap", kind: "raw", data: bytes(40_000) }] });
    view = queryHardDisk(file, { dir: "games" });
    expect(view.dir).toBe("games");
    expect(view.files.map((f) => [f.name, f.size])).toEqual([["GAMES/Manic Miner.tap", 40_000]]);
    expect(readHardDiskFile(file, "GAMES/Manic Miner.tap")).toEqual(bytes(40_000));
    expect(queryHardDisk(file).clusterUse!.some((u) => u > 0)).toBe(true);

    editHardDisk(file, { kind: "delete", names: ["GAMES/Manic Miner.tap"] });
    expect(queryHardDisk(file, { dir: "GAMES" }).files).toEqual([]);
  });
});

it("reports a disk with no file system instead of failing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-hdd-"));
  const file = path.join(dir, "blank.img");
  fs.writeFileSync(file, new Uint8Array(1024 * 1024));
  expect(queryHardDisk(file).fsError?.code).toBe("unformatted");
});

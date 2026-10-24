import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { createSp48Session } from "../harness/sp48";
import { copyHostFolderToHardDisk, createHardDiskImage, openHardDiskImage } from "@main/hard-disk-images";

/*
 * esxDOS on the 48K's DivMMC, end to end (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C6): a FAT16
 * card Klive makes and fills with esxDOS's own folders, the real esxDOS ROM, the real 48K ROM. Klive
 * cannot ship esxDOS, so this runs only where KLIVE_ESXDOS_DIR names an esxDOS distribution - its
 * 8K ROM (ESXMMC.BIN, or any 8192-byte .bin/.rom in the folder) and its BIN, SYS and TMP folders:
 *
 *   KLIVE_ESXDOS_DIR=~/esxdos085 npm test -- test/spectrum-hw/esxdos-e2e.test.ts
 *
 * Never in CI: nothing is downloaded, and without the folder the test is skipped.
 */

const dir = process.env.KLIVE_ESXDOS_DIR;

function findRom(folder: string): Uint8Array {
  const candidates = fs
    .readdirSync(folder)
    .filter((f) => /\.(bin|rom)$/i.test(f))
    .map((f) => path.join(folder, f))
    .filter((f) => fs.statSync(f).isFile() && fs.statSync(f).size === 0x2000);
  const preferred = candidates.find((f) => /esxmmc/i.test(path.basename(f))) ?? candidates[0];
  if (!preferred) throw new Error(`No 8K esxDOS ROM in ${folder}`);
  return new Uint8Array(fs.readFileSync(preferred));
}

describe.skipIf(!dir)("esxDOS on the DivMMC (KLIVE_ESXDOS_DIR)", () => {
  it("boots from a FAT16 card Klive made, and lists the card with .ls", async () => {
    const folder = dir!.replace(/^~(?=$|\/)/, os.homedir());
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "klive-esxdos-"));
    const card = path.join(work, "esxdos.img");
    createHardDiskImage(card, { sizeMb: 64, fatType: 16, label: "ESXDOS" });
    for (const name of ["BIN", "SYS", "TMP"]) {
      const source = fs.readdirSync(folder).find((f) => f.toUpperCase() === name);
      if (source) copyHostFolderToHardDisk(card, path.join(folder, source), name);
    }
    const device = openHardDiskImage(card);
    try {
      let reads = 0;
      const s = await createSp48Session();
      s.connectDivMmc(findRom(folder), {
        sectorCount: device.sectorCount,
        readSector: (sector) => {
          reads++;
          return device.readSector(sector);
        },
        writeSector: (sector, data) => device.writeSector(sector, data)
      });
      // --- esxDOS reads the card, then hands over to the 48K ROM, which reaches BASIC
      s.bootToBasic({ maxFrames: 1500 });
      expect(reads).toBeGreaterThan(0);
      // --- .ls (the dot starts a command; the letters follow in L mode), then ENTER
      s.typeKeys([["SShift", "M"], ["L"], ["S"], ["Enter"]]);
      s.runFrames(150);
      const screen = Array.from({ length: 24 }, (_, row) => s.screenLine(row)).join("\n");
      expect(screen).toMatch(/BIN/);
      expect(screen).toMatch(/SYS/);
    } finally {
      device.close();
      fs.rmSync(work, { recursive: true, force: true });
    }
  }, 300_000);
});

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import sharp from "sharp";

import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";
import { createSamSession } from "../../harness/samcoupe";

/*
 * Phase 7 of dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md: third-party software run side by side, for confidence, never
 * as a fixture. Runs only for dev/scripts/sam-parity/software.cjs, which sets SAM_SOFTWARE_DIR (the disks) and
 * SAM_SOFTWARE_OUT. Each disk boots as Run boots a disk (a key leaves the copyright screen, F9) and the picture
 * is saved every 5 s for a minute (`<disk>/klive-<seconds>.png`). A disk whose name contains "extmem" gets a
 * 1 MB external pack.
 */

const DIR = process.env.SAM_SOFTWARE_DIR;
const OUT = process.env.SAM_SOFTWARE_OUT;
const DISK = /\.(mgt|dsk|sad|sbt|gz)$/i;
const FRAMES_PER_SHOT = 250;
const SHOTS = 12;

describe.skipIf(!DIR || !OUT)("SAM software side by side (Phase 7)", () => {
  const disks = DIR ? readdirSync(DIR).filter((f) => DISK.test(f)).sort() : [];
  for (const disk of disks) {
    it(disk, async () => {
      const s = await createSamSession({ extmem: /extmem/i.test(disk) });
      s.insertDisk(0, new Uint8Array(readFileSync(join(DIR!, disk))));
      s.bootToCopyright();
      s.pressKey(SamKeyCode.Space).runFrames(20).pressKey(SamKeyCode.F9);
      const dir = join(OUT!, disk);
      mkdirSync(dir, { recursive: true });
      for (let shot = 1; shot <= SHOTS; shot++) {
        s.runFrames(FRAMES_PER_SHOT);
        const pixels = s.pixels().slice();
        const rgba = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.length * 4);
        await sharp(rgba, { raw: { width: 640, height: 288, channels: 4 } })
          .png()
          .toFile(join(dir, `klive-${String(shot * 5).padStart(3, "0")}.png`));
      }
      writeFileSync(join(dir, "klive.done"), "");
    }, 300_000);
  }
});

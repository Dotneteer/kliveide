import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createSp48Session } from "../harness/sp48";
import { KIT, kitMachine, loadKitFile, savePicture, screenText, type KitMachine, type KitSession } from "./kit";
import { PublishedPictures } from "./pictures";

/*
 * The kit's programs that only draw their result. Each runs on the machine it is for, and its picture
 * is written to `.spectrum-kit/` for a by-eye comparison with the real-machine photos and videos on
 * its ZXE wiki page (`vendor/spectrum-tests/kit.json` links them); none of them is a golden.
 *
 * The snow programs run twice, with the snow effect on and off. Those that show snow on a real
 * machine must show some here: their two pictures must differ.
 *
 * Snow48 (the first build) has a test of its own: its pair is published on the documentation site
 * (`pictures.ts`), so it shows what the snow effect does; the other snow programs stay unpublished.
 */

type Program = {
  name: string;
  file: string;
  machine: KitMachine["model"];
  frames?: number;
  slow?: boolean;
  /** A snow test: with the effect on, its picture differs from the one with it off */
  snows?: boolean;
};

const PROGRAMS: Program[] = [
  { name: "ula48-simple", file: "ula48-simple/ULA 48 Simple Test (2012-10-06)(azesmbog)[!].tap", machine: "48k" },
  { name: "ula128-timing", file: "ula128-timing/ULA 128 Timing Test (2012-10-06)(azesmbog)[!].tap", machine: "128k" },
  { name: "ula128e-plus3", file: "ula128e-plus3/ULA 128E +3 Test (2012-10-10)(azesmbog)[!].tap", machine: "plus2a" },
  { name: "ir-contention", file: "ir-contention/IR Contention (2023-01-08)(Woodmass, Mark)[!].tap", machine: "48k" },
  { name: "ir-contention-128", file: "ir-contention-128/IR Contention 128 (2023-07-02)(Woodmass, Mark)[!].tap", machine: "128k" },
  { name: "snow", file: "snow/Snow (2014-01-16)(Hikaru)[!].tap", machine: "48k", snows: true },
  // --- Asks for a cycle to test ("Cycle:"); the picture is its prompt
  { name: "snow-contention", file: "snow-contention/Snow Contention (2009-06-20)(Woodmass, Mark)[!].tap", machine: "48k" },
  { name: "snow-hold", file: "snow-hold/snowhold.tap", machine: "48k", snows: true },
  // --- Shows no difference with snow off: to be checked by eye against its wiki video
  { name: "snow-r", file: "snow-r/Snow R (2022-10-20)(Neo Spectruman)[!].tap", machine: "48k" },
  { name: "snow-tests-snow", file: "snow-tests/SnowTests/snow.tap", machine: "48k", snows: true },
  { name: "snow-tests-snow48", file: "snow-tests/SnowTests/snow48+.tap", machine: "48k", snows: true },
  { name: "snow-tests-snow128", file: "snow-tests/SnowTests/snow128+.tap", machine: "128k", snows: true },
  { name: "snow-tests-ula128", file: "snow-tests/SnowTests/ula128.tap", machine: "128k" },
  // --- An empty paper so far: to be checked by eye against its wiki video
  { name: "snow128n", file: "snow128n/snow128n.tap", machine: "128k" },
  { name: "ula-snow-crash", file: "ula-snow-crash/ULA Snow Crash (2018-02-06)(Panov, Astamur)[!].tap", machine: "128k" },
  ...[
    "Snow48 (var b) (2021-09-12)(azesmbog)[!].tap",
    "Snow48 (var b2) (2021-09-12)(azesmbog)[!].tap",
    "Snow48 (var b3) (2021-09-12)(azesmbog)[!].tap",
    "Snow48 (var b5) (2021-09-13)(azesmbog)[!].tap",
    "Snow48 (var b51) (2021-09-14)(azesmbog)[!].tap",
    "Snow48 (var b52) (2021-09-15)(azesmbog)[!].tap",
    "Snow48 (var b6) (2021-09-15)(azesmbog)[!].tap",
    "Snow48 (var b7) (2021-09-16)(azesmbog)[!].tap",
    "Snow48 (var b9) (2021-09-17)(azesmbog)[!].tap",
    "Snow48 (var c0) (2021-09-18)(azesmbog)[!].tap"
  ].map((file, i) => ({ name: `snow48-${i + 1}`, file: `snow48/${file}`, machine: "48k" as const, snows: true }))
];

async function picture(p: Program, snow: boolean, onPicture?: (s: KitSession, name: string) => void): Promise<string> {
  const s = await kitMachine({ model: p.machine, snow });
  loadKitFile(s, p.file, { slow: p.slow });
  s.runFrames(p.frames ?? 2000);
  const name = `${p.name}${snow ? "" : "-nosnow"}`;
  savePicture(s, name);
  onPicture?.(s, name);
  return s.screenHash();
}

describe.each(PROGRAMS)("$name", (p) => {
  it(p.snows ? "runs, and shows snow" : "runs", async () => {
    const withSnow = await picture(p, true);
    if (p.snows) {
      const without = await picture(p, false);
      expect(withSnow, "the pictures with and without snow").not.toBe(without);
    }
  }, 300_000);
});

describe("Snow48", () => {
  const snow48: Program = { name: "snow48", file: "snow48/Snow48 (2021-09-13)(azesmbog)[!].tap", machine: "48k" };

  it("runs, and shows snow (published)", async () => {
    const pictures = new PublishedPictures();
    const take = (s: KitSession, name: string) => pictures.take(s, name);
    const withSnow = await picture(snow48, true, take);
    const without = await picture(snow48, false, take);
    expect(withSnow, "the pictures with and without snow").not.toBe(without);
    pictures.settle();
  }, 300_000);
});

describe("Time to First INT", () => {
  /*
   * 1stint.rom (Peter Helcmanovsky, 2022, MIT): a ROM that measures the T-states from the reset to
   * the first interrupt and prints them. It replaces the 48K's ROM.
   */
  it("runs as the 48K's ROM", async () => {
    const rom = new Uint8Array(readFileSync(join(KIT, "time-to-first-int/1stint.rom")));
    const s = await createSp48Session({ rom });
    s.runFrames(200);
    savePicture(s, "time-to-first-int");
    expect(screenText(s).trim().length).toBeGreaterThan(0);
  }, 120_000);
});

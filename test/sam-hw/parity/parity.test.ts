import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { createSamSession } from "../../harness/samcoupe";
import { mgtToEdsk, mgtToSad } from "./diskFormats";
import { probeTape } from "./tapes";
import {
  EXPECTED_DIR,
  SOUND_RATE,
  probeHasSound,
  blankDisk2,
  buildProbeDisk,
  probeHasPicture,
  probeNames,
  probeMachine,
  readResult,
  recordMap,
  runProbeInKlive
} from "./parity";

/*
 * The parity probes' pinned results (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md §2). Each probe runs in Klive
 * and its result block must match `expected/<probe>.json`: values decided from an oracle run of SimCoupé
 * 1.2.17, a hardware measurement, the research pack or a Klive decision (each value says which).
 *
 * With SAM_PARITY_OUT=<dir> (dev/scripts/sam-parity/oracle.cjs sets it), each probe also writes its boot
 * disk (`<probe>/probe.mgt`), Klive's written-back disk (`klive.mgt`) and Klive's records (`klive.json`)
 * there for the oracle run, a probe marked "@picture" its 640 x 288 picture (`klive.png`), and one marked
 * "@tape <name>" its tape (`<name>.tzx`), one marked "@sound" its output (`klive.wav`, 48 kHz).
 */

type Expected = {
  probe: string;
  /** For a picture probe: the white runs per picture row, [start hc, end hc], and/or the picture's hash */
  picture?: { runs?: Record<string, [number, number]>; sha256?: string; note?: string };
  records: Record<string, { value: number; source: string; date: string; note?: string }>;
};

const OUT = process.env.SAM_PARITY_OUT;
const ONLY = process.env.SAM_PARITY_PROBES?.split(",").filter(Boolean);

/** A 16-bit stereo WAV of samples in -1..1 */
function wav16(left: number[], right: number[], rate: number): Buffer {
  const n = left.length;
  const b = Buffer.alloc(44 + n * 4);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 4, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 4, 40);
  const clip = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(clip(left[i]), 44 + i * 4);
    b.writeInt16LE(clip(right[i]), 46 + i * 4);
  }
  return b;
}

/** Per row of the 640 x 288 picture with white in it, the run's [start hc, end hc] (picture.cjs's rule) */
function whiteRuns(pixels: Uint32Array): Record<string, [number, number]> {
  const hc = (x: number) => (x < 576 ? 96 + x / 2 : (x - 576) / 2 + 384);
  const runs: Record<string, [number, number]> = {};
  for (let r = 0; r < 288; r++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < 640; x++) {
      const p = pixels[r * 640 + x];
      if ((p & 0xff) > 200 && ((p >> 8) & 0xff) > 200 && ((p >> 16) & 0xff) > 200) {
        if (a < 0) a = x;
        b = x;
      }
    }
    if (a >= 0) runs[String(r)] = [hc(a), hc(b + 1)];
  }
  return runs;
}

/*
 * With SAM_PARITY_OUT, the boot screens too (oracle.cjs's "screens"): the copyright screen and SAM BASIC's
 * with a space typed, for ROM 3.0 and 3.1, as 640 x 288 pictures (`screens/<rom>-<screen>.png`). Their hashes are
 * pinned by test/sam-hw/boot-picture.test.ts.
 */
describe.skipIf(!OUT)("SAM boot screens for the oracle", () => {
  for (const rom of ["30", "31"]) {
    it(`ROM ${rom}`, async () => {
      const dir = join(OUT!, "screens");
      mkdirSync(dir, { recursive: true });
      const save = async (pixels: Uint32Array, file: string) => {
        const rgba = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.length * 4);
        await sharp(rgba, { raw: { width: 640, height: 288, channels: 4 } }).png().toFile(join(dir, file));
      };
      const s = await createSamSession({ rom });
      s.bootToCopyright().runFrames(10);
      await save(s.pixels().slice(), `${rom}-copyright-klive.png`);
      const b = await createSamSession({ rom });
      // --- SimCoupé's -keyin " " also types the space into the edit line
      b.bootToBasic().typeKeys(" ").runFrames(10);
      await save(b.pixels().slice(), `${rom}-basic-klive.png`);
    }, 60_000);
  }
});

describe("SAM parity probes", () => {
  for (const name of probeNames()) {
    if (ONLY && !ONLY.includes(name)) continue;
    it(`${name} matches its pinned results`, async () => {
      const disk = await buildProbeDisk(name);
      let pixels: Uint32Array | undefined;
      const left: number[] = [];
      const right: number[] = [];
      const image = await runProbeInKlive(disk, {
        ...probeMachine(name),
        picture: probeHasPicture(name) ? (p) => (pixels = p.slice()) : undefined,
        audio:
          OUT && probeHasSound(name)
            ? (l, r) => {
                left.push(...l);
                right.push(...r);
              }
            : undefined
      });
      const result = readResult(image);
      expect(result, "the result block").toBeDefined();
      const values = recordMap(result!);
      if (OUT) {
        const dir = join(OUT, name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "probe.mgt"), disk);
        if (probeMachine(name).disk2) writeFileSync(join(dir, "disk2.mgt"), blankDisk2());
        // --- "@tape": the tape SimCoupé gets through its tape browser
        const tape = probeMachine(name).tape;
        if (tape) writeFileSync(join(dir, `${tape}.tzx`), probeTape(tape));
        const format = probeMachine(name).image;
        if (format === "sad") writeFileSync(join(dir, "probe.sad"), mgtToSad(disk));
        if (format === "edsk") writeFileSync(join(dir, "probe.dsk"), mgtToEdsk(disk));
        writeFileSync(join(dir, "klive.mgt"), image);
        writeFileSync(join(dir, "klive.json"), JSON.stringify(values, null, 2));
        if (left.length) writeFileSync(join(dir, "klive.wav"), wav16(left, right, SOUND_RATE));
        if (pixels) {
          // --- The 640 x 288 picture, for dev/scripts/sam-parity/picture.cjs
          const rgba = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.length * 4);
          await sharp(rgba, { raw: { width: 640, height: 288, channels: 4 } }).png().toFile(join(dir, "klive.png"));
        }
      }
      const file = join(EXPECTED_DIR, `${name}.json`);
      if (!existsSync(file)) {
        // --- A probe without pinned results yet only has to run (the oracle run decides them)
        expect(result!.records.length).toBeGreaterThan(0);
        return;
      }
      const expected = JSON.parse(readFileSync(file, "utf8")) as Expected;
      for (const [key, want] of Object.entries(expected.records)) {
        expect(values[key], `${name}.${key} (${want.source})`).toBe(want.value);
      }
      if (expected.picture && pixels) {
        if (expected.picture.runs) {
          expect(whiteRuns(pixels), `${name}: the picture's white runs`).toEqual(expected.picture.runs);
        }
        if (expected.picture.sha256) {
          const hash = createHash("sha256").update(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.length * 4)).digest("hex");
          expect(hash, `${name}: the picture (${expected.picture.note ?? "checked against SimCoupé"})`).toBe(expected.picture.sha256);
        }
      }
    }, 60_000);
  }
});

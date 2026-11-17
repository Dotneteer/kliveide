import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

/*
 * Where the Next's SD cards live and how a working copy is made (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phases 1 and 3): the installer's gzipped card (or, in development, a fetched one), then a downloaded one; a working copy decompressed
 * and checked against the manifest, never left half-written under its real name.
 */

const home = { dir: "" };
vi.mock("@main/portable", () => ({ getKliveHomeBase: () => home.dir }));

import { NEXT_ROM_SETS, type NextSdBaseImage } from "@common/zxnext/romSets";
import {
  NextSdCardMismatchError,
  availableCard,
  availableCardOf,
  bundledCardPath,
  downloadedCardPath,
  downloadedCards,
  isModelReady,
  needsDownload,
  workingCopyPath,
  writeCardFrom
} from "@main/next-sd/nextSdCards";

const SET = "nextzxos-2.10" as const;
const CARD = new Uint8Array(8192).map((_, i) => (i * 7) & 0xff);
let saved: Pick<NextSdBaseImage, "size" | "sha256">;
let savedPublic: string | undefined;

beforeEach(() => {
  home.dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-sd-cards-"));
  savedPublic = process.env.PUBLIC;
  process.env.PUBLIC = path.join(home.dir, "resources");
  // --- The stand-in card's bytes are the manifest's for this test
  const entry = NEXT_ROM_SETS[SET].sdBaseImage;
  saved = { size: entry.size, sha256: entry.sha256 };
  Object.assign(entry, { size: CARD.length, sha256: createHash("sha256").update(CARD).digest("hex") });
});
afterEach(() => {
  Object.assign(NEXT_ROM_SETS[SET].sdBaseImage, saved);
  process.env.PUBLIC = savedPublic;
  fs.rmSync(home.dir, { recursive: true, force: true });
});

function put(file: string, bytes: Uint8Array): string {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return file;
}

const bundledGz = () => path.join(process.env.PUBLIC!, "next-sd", `${SET}.cim.gz`);
const devCards = () => path.join(home.dir, "dev-cards");
const devRaw = () => path.join(devCards(), `${SET}-base.cim`);

describe("finding a set's base card", () => {
  it("finds none when neither the installer nor a download has it", () => {
    expect(availableCard(SET)).toBeUndefined();
    expect(bundledCardPath(SET)).toBeUndefined();
  });

  it("puts downloads in <Klive home>/next-sd", () => {
    expect(downloadedCardPath(SET)).toBe(path.join(home.dir, "Klive", "next-sd", `${SET}.cim.gz`));
    put(downloadedCardPath(SET), gzipSync(CARD));
    expect(availableCard(SET)).toEqual({ setId: SET, file: downloadedCardPath(SET), source: "downloaded", compressed: true });
  });

  it("prefers the installer's card to a downloaded one", () => {
    put(downloadedCardPath(SET), gzipSync(CARD));
    expect(availableCard(SET)).toMatchObject({ source: "downloaded" });
    put(bundledGz(), gzipSync(CARD));
    expect(availableCard(SET)).toMatchObject({ file: bundledGz(), source: "bundled", compressed: true });
    expect(availableCardOf("ks2-30204")?.file).toBe(bundledGz());
  });
});

describe("a development run", () => {
  it("also takes the cards npm run next-sd:fetch puts in .local/next-sd, raw before gzipped", () => {
    const dev = devCards();
    process.env.KLIVE_NEXT_SD_DEV_CARDS = dev;
    try {
      put(path.join(dev, `${SET}.cim.gz`), gzipSync(CARD));
      expect(availableCard(SET)).toMatchObject({ file: path.join(dev, `${SET}.cim.gz`), source: "bundled", compressed: true });
      put(path.join(dev, `${SET}-base.cim`), CARD);
      expect(availableCard(SET)).toMatchObject({ file: path.join(dev, `${SET}-base.cim`), compressed: false });
    } finally {
      delete process.env.KLIVE_NEXT_SD_DEV_CARDS;
    }
  });
});

describe("making a working copy", () => {
  it("decompresses a gzipped card", async () => {
    put(bundledGz(), gzipSync(CARD));
    const target = workingCopyPath("ks2-30204");
    await writeCardFrom(availableCard(SET)!, target);
    expect(new Uint8Array(fs.readFileSync(target))).toEqual(CARD);
    expect(fs.existsSync(`${target}.partial`)).toBe(false);
  });

  it("copies a raw card", async () => {
    put(devRaw(), CARD);
    process.env.KLIVE_NEXT_SD_DEV_CARDS = devCards();
    try {
      const target = path.join(home.dir, "copy.cim");
      await writeCardFrom(availableCard(SET)!, target);
      expect(new Uint8Array(fs.readFileSync(target))).toEqual(CARD);
    } finally {
      delete process.env.KLIVE_NEXT_SD_DEV_CARDS;
    }
  });

  it("refuses a card that is not the manifest's, and keeps the card it would have replaced", async () => {
    put(bundledGz(), gzipSync(CARD.map((b) => b ^ 1)));
    const target = put(path.join(home.dir, "mine.cim"), new Uint8Array([1, 2, 3]));
    await expect(writeCardFrom(availableCard(SET)!, target)).rejects.toBeInstanceOf(NextSdCardMismatchError);
    expect(new Uint8Array(fs.readFileSync(target))).toEqual(new Uint8Array([1, 2, 3]));
    expect(fs.existsSync(`${target}.partial`)).toBe(false);
  });

  it("refuses a gzipped card cut short", async () => {
    const gz = gzipSync(CARD);
    put(bundledGz(), gz.subarray(0, gz.length - 100));
    const target = path.join(home.dir, "cut.cim");
    await expect(writeCardFrom(availableCard(SET)!, target)).rejects.toThrow();
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(`${target}.partial`)).toBe(false);
  });
});

describe("isModelReady", () => {
  it("is false with neither a base card nor a working copy", () => {
    expect(isModelReady("ks2-30204")).toBe(false);
  });

  it("is true once the set's base card is here", () => {
    put(downloadedCardPath(SET), gzipSync(CARD));
    expect(isModelReady("ks2-30204")).toBe(true);
    // --- Another set's model still needs its own card
    expect(isModelReady("ks2-30201")).toBe(false);
  });

  it("is false for a working copy that does not pass the check", () => {
    put(workingCopyPath("ks2-30204"), new Uint8Array(4096));
    expect(isModelReady("ks2-30204")).toBe(false);
  });
});

describe("the downloaded cards (phase 5)", () => {
  it("are listed with their sizes on disk", () => {
    expect(downloadedCards()).toEqual([]);
    const gz = gzipSync(CARD);
    put(downloadedCardPath(SET), gz);
    expect(downloadedCards()).toEqual([{ setId: SET, file: downloadedCardPath(SET), bytes: gz.length }]);
  });

  it("make a model's need for a download go away, as does a working copy", () => {
    expect(needsDownload("ks2-30204")).toBe(true);
    put(workingCopyPath("ks2-30204"), new Uint8Array(512));
    expect(needsDownload("ks2-30204")).toBe(false);
    expect(needsDownload("ks2-30201")).toBe(true);
    put(downloadedCardPath("nextzxos-2.08"), gzipSync(CARD));
    expect(needsDownload("ks2-30201")).toBe(false);
  });
});

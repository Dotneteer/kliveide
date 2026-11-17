import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";

import type { NextRomSetId, NextSdBaseImage } from "@common/zxnext/romSets";
import { NEXT_ROM_SETS } from "@common/zxnext/romSets";
import { nextProfileOf, romSetOf } from "@emu/machines/zxNext/nextProfiles";
import { getKliveHomeBase } from "@main/portable";
import { KLIVE_HOME_FOLDER } from "@main/settings";
import { checkNextSdCard } from "./checkNextSdCard";

/*
 * Where the ZX Spectrum Next's SD cards live (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 1).
 *
 * A *base card* belongs to a ROM set (D-1): the installer carries the default model's (D-2), the others
 * are downloaded into the Klive home folder (D-4). A *working copy* belongs to a model
 * (`~/Klive/<sdWorkingCopy>`, `dev/ai/zxnext-models.md` D7) and is made from its set's base card the
 * first time the model runs, or again when the user resets it. Everything that needs a base card asks
 * this module; nothing else builds those paths.
 */

/** Where a base card was found */
export type NextSdCardSource = "bundled" | "downloaded";

export type AvailableNextSdCard = {
  setId: NextRomSetId;
  /** The file's full path */
  file: string;
  source: NextSdCardSource;
  /** A `<setId>.cim.gz`, decompressed when a working copy is made from it */
  compressed: boolean;
};

/** The folder of the downloaded base cards: `<Klive home>/next-sd` */
export function downloadedCardsFolder(): string {
  return path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, "next-sd");
}

/** Where a set's downloaded base card is (or will be): `<Klive home>/next-sd/<setId>.cim.gz` */
export function downloadedCardPath(setId: NextRomSetId): string {
  return path.join(downloadedCardsFolder(), `${setId}.cim.gz`);
}

/**
 * The places a set's base card may come with Klive, in the order they are tried: the installer's
 * gzipped card (`<resources>/next-sd/<setId>.cim.gz`), then, in a development run, the cards
 * `npm run next-sd:fetch` puts in `.local/next-sd/` (`KLIVE_NEXT_SD_DEV_CARDS`, set by `src/main/index.ts`
 * when the app is not packaged). The repository carries no card (D-6).
 */
export function bundledCardPaths(setId: NextRomSetId): AvailableNextSdCard[] {
  const resources = process.env.PUBLIC ?? "";
  const devCards = process.env.KLIVE_NEXT_SD_DEV_CARDS;
  return [
    { setId, file: path.join(resources, "next-sd", `${setId}.cim.gz`), source: "bundled", compressed: true },
    ...(devCards
      ? ([
          { setId, file: path.join(devCards, `${setId}-base.cim`), source: "bundled", compressed: false },
          { setId, file: path.join(devCards, `${setId}.cim.gz`), source: "bundled", compressed: true }
        ] as AvailableNextSdCard[])
      : [])
  ];
}

/** The installer's base card of a set, when it carries one */
export function bundledCardPath(setId: NextRomSetId): string | undefined {
  return bundledCardPaths(setId).find((card) => isFile(card.file))?.file;
}

/** A set's base card on this machine, bundled or downloaded; undefined when it has to be downloaded */
export function availableCard(setId: NextRomSetId): AvailableNextSdCard | undefined {
  const bundled = bundledCardPaths(setId).find((card) => isFile(card.file));
  if (bundled) return bundled;
  const downloaded = downloadedCardPath(setId);
  return isFile(downloaded) ? { setId, file: downloaded, source: "downloaded", compressed: true } : undefined;
}

/** The base cards downloaded into `<Klive home>/next-sd`, with their sizes on disk */
export function downloadedCards(): { setId: NextRomSetId; file: string; bytes: number }[] {
  return (Object.keys(NEXT_ROM_SETS) as NextRomSetId[])
    .filter((setId) => NEXT_ROM_SETS[setId].sdBaseImage)
    .map((setId) => ({ setId, file: downloadedCardPath(setId) }))
    .filter((card) => isFile(card.file))
    .map((card) => ({ ...card, bytes: fs.statSync(card.file).size }));
}

/** A model's working copy: `<Klive home>/<sdWorkingCopy>` */
export function workingCopyPath(modelId: string | undefined): string {
  return path.join(getKliveHomeBase(), KLIVE_HOME_FOLDER, nextProfileOf(modelId).sdWorkingCopy);
}

/** The base card a model's working copy is made from, when it is on this machine */
export function availableCardOf(modelId: string | undefined): AvailableNextSdCard | undefined {
  return availableCard(romSetOf(nextProfileOf(modelId)).id);
}

/**
 * Whether a model can run (D-7): its working copy passes the check, or its set's base card is here to
 * make one from. A model that is not ready needs its card downloaded first.
 */
export function isModelReady(modelId: string | undefined): boolean {
  if (availableCardOf(modelId)) return true;
  return checkNextSdCard(workingCopyPath(modelId), modelId).status === "ok";
}

/**
 * Whether a model needs its card downloaded before it can run, as the model lists show it: no base
 * card and no working copy. Cheap (two file lookups); the full check runs when the model is chosen.
 */
export function needsDownload(modelId: string | undefined): boolean {
  return !availableCardOf(modelId) && !isFile(workingCopyPath(modelId));
}

/** A base card that does not have the manifest's bytes */
export class NextSdCardMismatchError extends Error {
  constructor(
    readonly source: string,
    readonly expected: { size: number; sha256: string },
    readonly actual: { size: number; sha256: string }
  ) {
    super(
      `${source} is not the expected SD card: ${actual.size} bytes, sha256 ${actual.sha256}; ` +
        `expected ${expected.size} bytes, sha256 ${expected.sha256}`
    );
    this.name = "NextSdCardMismatchError";
  }
}

/**
 * Writes a set's raw card from a base card (decompressing a `.cim.gz`), checking the bytes against the
 * manifest's size and sha256 on the way. The card is written as `<target>.partial` and renamed only
 * when it is complete and correct, so an interrupted or wrong copy never takes the target's name; an
 * existing target is replaced only then.
 */
export async function writeCardFrom(card: AvailableNextSdCard, target: string): Promise<void> {
  const expected: NextSdBaseImage = NEXT_ROM_SETS[card.setId].sdBaseImage;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const partial = `${target}.partial`;
  const hash = createHash("sha256");
  let size = 0;
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      hash.update(chunk);
      size += chunk.length;
      done(null, chunk);
    }
  });
  try {
    const source = fs.createReadStream(card.file);
    const sink = fs.createWriteStream(partial);
    if (card.compressed) {
      await pipeline(source, createGunzip(), measure, sink);
    } else {
      await pipeline(source, measure, sink);
    }
    const actual = { size, sha256: hash.digest("hex") };
    if (actual.size !== expected.size || actual.sha256 !== expected.sha256) {
      throw new NextSdCardMismatchError(card.file, expected, actual);
    }
    fs.renameSync(partial, target);
  } catch (err) {
    fs.rmSync(partial, { force: true });
    throw err;
  }
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

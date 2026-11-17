import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { createGunzip, createGzip } from "zlib";

import type { NextSdCardErrorKind, NextSdCardFailure } from "@common/zxnext/nextSdDownload";
import type { NextRomSetId, NextSdBaseImage } from "@common/zxnext/romSets";
import { NEXT_ROM_SETS } from "@common/zxnext/romSets";
import { downloadedCardPath } from "./nextSdCards";

/*
 * Downloading and importing a ZX Spectrum Next SD base card (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phase 4, D-4, D-5). A card comes from one fixed place, `https://kliveide.net/next-sd/<setId>.cim.gz`,
 * and is accepted only with the manifest's bytes: the download by its `gzSize` and `gzSha256`, an
 * imported file by its raw `size` and `sha256`. Either way the card lands in
 * `<Klive home>/next-sd/<setId>.cim.gz` under a `.partial` name first, so a card cut short or wrong never
 * takes the real name.
 */

/** Where the published cards are */
export const NEXT_SD_CARDS_URL = "https://kliveide.net/next-sd/";

/**
 * The folder the cards are downloaded from: the fixed one, or `KLIVE_NEXT_SD_BASE_URL` in a Klive that
 * is not packaged (tests and development, D-5)
 */
export function nextSdCardsBaseUrl(isPackaged: boolean, env: NodeJS.ProcessEnv = process.env): string {
  const override = isPackaged ? undefined : env.KLIVE_NEXT_SD_BASE_URL;
  const url = override || NEXT_SD_CARDS_URL;
  return url.endsWith("/") ? url : `${url}/`;
}

/** A set's published card */
export function nextSdCardUrl(setId: NextRomSetId, baseUrl: string): string {
  return `${baseUrl}${setId}.cim.gz`;
}

export class NextSdCardError extends Error {
  constructor(
    readonly kind: NextSdCardErrorKind,
    message: string,
    /** The HTTP status (`http`), the bytes needed (`noSpace`) */
    readonly detail?: number
  ) {
    super(message);
    this.name = "NextSdCardError";
  }

  /** The failure as the dialog receives it */
  toFailure(): NextSdCardFailure {
    return { kind: this.kind, message: this.message, detail: this.detail };
  }
}

/** Any error as a failure the dialog can word */
export function nextSdCardFailureOf(err: unknown): NextSdCardFailure {
  if (err instanceof NextSdCardError) return err.toFailure();
  return { kind: "unreadable", message: err instanceof Error ? err.message : String(err) };
}

/** The part of `fetch` the downloader uses: Electron's `net.fetch` in the app, Node's in tests */
export type NextSdFetch = (url: string, init: { signal?: AbortSignal; redirect: "manual"; headers: Record<string, string> }) => Promise<Response>;

export type NextSdDownloadOptions = {
  fetch: NextSdFetch;
  baseUrl: string;
  /** Called as bytes arrive: the bytes so far and the card's gzipped size */
  onProgress?: (received: number, total: number) => void;
  signal?: AbortSignal;
  /** The free bytes in a folder; `fs.statfs` when omitted (tests pass a stand-in) */
  freeBytes?: (folder: string) => Promise<number>;
};

/**
 * Downloads a set's base card into `<Klive home>/next-sd/<setId>.cim.gz` and returns that path.
 * Throws a `NextSdCardError` and leaves no file when the server answers anything but the manifest's
 * bytes, the download is cancelled, or the disk is too full for the card and its working copy.
 */
export async function downloadNextSdCard(setId: NextRomSetId, options: NextSdDownloadOptions): Promise<string> {
  const card = NEXT_ROM_SETS[setId].sdBaseImage;
  const target = downloadedCardPath(setId);
  const folder = path.dirname(target);
  fs.mkdirSync(folder, { recursive: true });
  // --- The .gz and the working copy made from it
  await ensureFreeSpace(folder, card.gzSize + card.size, options.freeBytes);

  const url = nextSdCardUrl(setId, options.baseUrl);
  let response: Response;
  try {
    response = await options.fetch(url, {
      signal: options.signal,
      // --- Only the one host (D-5): a redirect anywhere is refused rather than followed
      redirect: "manual",
      headers: { "accept-encoding": "identity" }
    });
  } catch (err) {
    throw options.signal?.aborted ? cancelled() : new NextSdCardError("network", `${url}: ${errorText(err)}`);
  }
  if (response.status >= 300 && response.status < 400) {
    throw new NextSdCardError("redirected", `${url} redirects elsewhere (HTTP ${response.status})`, response.status);
  }
  if (response.status !== 200 || !response.body) {
    throw new NextSdCardError("http", `${url}: HTTP ${response.status}`, response.status);
  }
  const encoding = response.headers.get("content-encoding");
  if (encoding && encoding !== "identity") {
    // --- A server or proxy that compressed the .gz again would not give the published bytes
    throw new NextSdCardError("encoded", `${url} came back re-encoded (${encoding})`);
  }

  const total = card.gzSize;
  let received = 0;
  const partial = `${target}.partial`;
  const hash = createHash("sha256");
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      received += chunk.length;
      if (received > total) {
        done(new NextSdCardError("tooLarge", `${url} is larger than the card (${total} bytes)`));
        return;
      }
      hash.update(chunk);
      options.onProgress?.(received, total);
      done(null, chunk);
    }
  });
  try {
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      measure,
      fs.createWriteStream(partial)
    );
    const sha256 = hash.digest("hex");
    if (received !== card.gzSize || sha256 !== card.gzSha256) {
      throw new NextSdCardError(
        "wrongCard",
        `${url} is not the expected card: ${received} bytes, sha256 ${sha256}; expected ${card.gzSize} bytes, sha256 ${card.gzSha256}`
      );
    }
    fs.renameSync(partial, target);
    return target;
  } catch (err) {
    fs.rmSync(partial, { force: true });
    if (err instanceof NextSdCardError) throw err;
    throw options.signal?.aborted ? cancelled() : new NextSdCardError("network", `${url}: ${errorText(err)}`);
  }
}

/**
 * Imports a card the user downloaded elsewhere (a `.cim.gz` or a `.cim`) as the set's downloaded card,
 * for users who cannot reach kliveide.net from Klive. The file is accepted when its raw bytes are the
 * manifest's; a `.gz` is copied as it is, a raw card is gzipped. Returns the stored card's path.
 */
export async function importNextSdCard(
  setId: NextRomSetId,
  file: string,
  freeBytes?: (folder: string) => Promise<number>
): Promise<string> {
  const card = NEXT_ROM_SETS[setId].sdBaseImage;
  const target = downloadedCardPath(setId);
  const folder = path.dirname(target);
  fs.mkdirSync(folder, { recursive: true });
  await ensureFreeSpace(folder, card.gzSize + card.size, freeBytes);
  const compressed = await isGzip(file);
  // --- The raw bytes decide, whichever form the file is in
  const actual = await rawFacts(file, compressed);
  if (actual.size !== card.size || actual.sha256 !== card.sha256) {
    throw new NextSdCardError(
      "wrongCard",
      `${file} is not the ${setId} card: ${actual.size} bytes, sha256 ${actual.sha256}; expected ${card.size} bytes, sha256 ${card.sha256}`
    );
  }
  const partial = `${target}.partial`;
  try {
    if (compressed) {
      await pipeline(fs.createReadStream(file), fs.createWriteStream(partial));
    } else {
      await pipeline(fs.createReadStream(file), createGzip(), fs.createWriteStream(partial));
    }
    fs.renameSync(partial, target);
    return target;
  } catch (err) {
    fs.rmSync(partial, { force: true });
    throw new NextSdCardError("unreadable", `${file}: ${errorText(err)}`);
  }
}

/** A set's download sizes, for the dialog */
export function nextSdCardSizes(setId: NextRomSetId): Pick<NextSdBaseImage, "gzSize" | "size"> {
  const { gzSize, size } = NEXT_ROM_SETS[setId].sdBaseImage;
  return { gzSize, size };
}

async function ensureFreeSpace(
  folder: string,
  needed: number,
  freeBytes: ((folder: string) => Promise<number>) | undefined
): Promise<void> {
  const free = await (freeBytes ?? statfsFree)(folder);
  if (free < needed) {
    throw new NextSdCardError("noSpace", `${folder} has ${free} bytes free; the card needs ${needed}`, needed);
  }
}

async function statfsFree(folder: string): Promise<number> {
  try {
    const stats = await fs.promises.statfs(folder);
    return stats.bavail * stats.bsize;
  } catch {
    // --- A file system that cannot say: let the write itself fail if it must
    return Number.MAX_SAFE_INTEGER;
  }
}

async function isGzip(file: string): Promise<boolean> {
  let handle: fs.promises.FileHandle | undefined;
  try {
    handle = await fs.promises.open(file, "r");
    const head = Buffer.alloc(2);
    await handle.read(head, 0, 2, 0);
    return head[0] === 0x1f && head[1] === 0x8b;
  } catch (err) {
    throw new NextSdCardError("unreadable", `${file}: ${errorText(err)}`);
  } finally {
    await handle?.close();
  }
}

async function rawFacts(file: string, compressed: boolean): Promise<{ size: number; sha256: string }> {
  const hash = createHash("sha256");
  let size = 0;
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      hash.update(chunk);
      size += chunk.length;
      done();
    }
  });
  try {
    if (compressed) {
      await pipeline(fs.createReadStream(file), createGunzip(), measure);
    } else {
      await pipeline(fs.createReadStream(file), measure);
    }
  } catch (err) {
    throw new NextSdCardError("unreadable", `${file}: ${errorText(err)}`);
  }
  return { size, sha256: hash.digest("hex") };
}

function cancelled(): NextSdCardError {
  return new NextSdCardError("cancelled", "The download was cancelled");
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

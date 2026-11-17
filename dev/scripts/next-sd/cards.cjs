/*
 * The ZX Spectrum Next SD base cards for Klive's developer tools (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phase 3): where they live locally, where they are published, and how their bytes are checked.
 *
 * - The manifest (`src/common/zxnext/nextRomSets.json`, each set's `sdBaseImage`) is the trust anchor
 *   (D-5): the raw card's `size` and `sha256`, the gzipped card's `gzSize` and `gzSha256`.
 * - Published cards are `https://kliveide.net/next-sd/<setId>.cim.gz` on the `gh-pages` branch, outside
 *   the docs build (D-4). `KLIVE_NEXT_SD_BASE_URL` points the tools at another server (tests).
 * - Locally (git-ignored, D-6): `.local/next-sd/<setId>.cim.gz` (the published bytes) and
 *   `.local/next-sd/<setId>-base.cim` (the raw card, what tests and tools read). `KLIVE_NEXT_SD_LOCAL`
 *   names another folder (tests).
 */
const { createHash } = require("node:crypto");
const { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const { dirname, join } = require("node:path");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { createGunzip, createGzip } = require("node:zlib");
const { REPO_ROOT } = require("../repo-root.cjs");

const MANIFEST = join(REPO_ROOT, "src/common/zxnext/nextRomSets.json");
/** `KLIVE_NEXT_SD_LOCAL` points the tools at another folder (tests) */
const LOCAL = process.env.KLIVE_NEXT_SD_LOCAL || join(REPO_ROOT, ".local/next-sd");
const PUBLISHED_FOLDER = "next-sd";
const DEFAULT_BASE_URL = `https://kliveide.net/${PUBLISHED_FOLDER}/`;
/** The project author's rule (D-4): at most five Next models, so at most five cards on the site */
const MAX_PUBLISHED_CARDS = 5;

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}

/** Every set with an SD base image: `[{ setId, card }]` */
function cardSets(manifest = readManifest()) {
  return Object.entries(manifest)
    .filter(([, set]) => set?.sdBaseImage)
    .map(([setId, set]) => ({ setId, card: set.sdBaseImage }));
}

function cardOf(setId, manifest = readManifest()) {
  const card = manifest[setId]?.sdBaseImage;
  if (!card) throw new Error(`'${setId}' is not a ROM set with an SD base image in ${MANIFEST}`);
  return card;
}

const gzName = (setId) => `${setId}.cim.gz`;
const localGz = (setId) => join(LOCAL, gzName(setId));
const localBase = (setId) => join(LOCAL, `${setId}-base.cim`);

function baseUrl() {
  const url = process.env.KLIVE_NEXT_SD_BASE_URL || DEFAULT_BASE_URL;
  return url.endsWith("/") ? url : `${url}/`;
}

const publishedUrl = (setId) => `${baseUrl()}${gzName(setId)}`;

/** A stream's bytes counted and hashed as they pass */
function measuring() {
  const hash = createHash("sha256");
  let size = 0;
  const stream = new Transform({
    transform(chunk, _encoding, done) {
      hash.update(chunk);
      size += chunk.length;
      done(null, chunk);
    }
  });
  return { stream, result: () => ({ size, sha256: hash.digest("hex") }) };
}

/** A file's size and sha256 */
async function fileFacts(file) {
  const measure = measuring();
  await pipeline(createReadStream(file), measure.stream, async function* (source) {
    for await (const _chunk of source); // --- drain
  });
  return measure.result();
}

/** Whether a gzipped card is the manifest's (`gzSize`, `gzSha256`) */
async function isPublishedGz(file, card) {
  if (!existsSync(file)) return false;
  const facts = await fileFacts(file);
  return facts.size === card.gzSize && facts.sha256 === card.gzSha256;
}

/** Whether a raw card is the manifest's (`size`, `sha256`) */
async function isRawCard(file, card) {
  if (!existsSync(file) || statSync(file).size !== card.size) return false;
  return (await fileFacts(file)).sha256 === card.sha256;
}

/**
 * Writes `target` through `<target>.partial`, renamed only when `check(facts)` accepts the bytes the
 * pipeline wrote; a refused or failed write leaves no file
 */
async function writeChecked(target, streams, check) {
  mkdirSync(dirname(target), { recursive: true });
  const partial = `${target}.partial`;
  const measure = measuring();
  try {
    await pipeline(...streams, measure.stream, createWriteStream(partial));
    const facts = measure.result();
    const problem = check(facts);
    if (problem) throw new Error(problem);
    renameSync(partial, target);
    return facts;
  } finally {
    rmSync(partial, { force: true });
  }
}

const mismatch = (what, facts, size, sha256) =>
  facts.size === size && facts.sha256 === sha256
    ? undefined
    : `${what}: ${facts.size} bytes, sha256 ${facts.sha256}; the manifest pins ${size} bytes, ${sha256}`;

/** Decompresses a gzipped card into the raw card, checking the raw bytes */
function gunzipCard(gz, target, card) {
  return writeChecked(target, [createReadStream(gz), createGunzip()], (facts) =>
    mismatch(`${gz} decompressed`, facts, card.size, card.sha256)
  );
}

/** Gzips a raw card at level 9 (D-6: only for a card that was never published) */
function gzipCard(raw, target) {
  return writeChecked(target, [createReadStream(raw), createGzip({ level: 9 })], () => undefined);
}

/** `GET url` as a stream (redirects followed), or the status when it is not 200 */
function get(url, method = "GET", redirects = 5) {
  return new Promise((resolvePromise, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.request(url, { method, headers: { "accept-encoding": "identity" } }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location && redirects > 0) {
        response.resume();
        resolvePromise(get(new URL(response.headers.location, url).toString(), method, redirects - 1));
        return;
      }
      resolvePromise({ status, response });
    });
    request.on("error", reject);
    request.setTimeout(60_000, () => request.destroy(new Error(`${url}: no answer for 60 s`)));
    request.end();
  });
}

/** Downloads a published gzipped card, accepted only with the manifest's `gzSize` and `gzSha256` */
async function downloadGz(setId, target, card) {
  const url = publishedUrl(setId);
  const { status, response } = await get(url);
  if (status !== 200) {
    response.resume();
    const error = new Error(`${url}: HTTP ${status}`);
    error.status = status;
    throw error;
  }
  if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
    response.resume();
    throw new Error(`${url}: the server re-encoded the card (${response.headers["content-encoding"]})`);
  }
  await writeChecked(target, [response], (facts) => mismatch(url, facts, card.gzSize, card.gzSha256));
  return url;
}

/**
 * The Next model a new project starts on (`NEW_PROJECT_NEXT_PROFILE_ID`) and its working copy's file
 * name and ROM set, read from `nextProfiles.ts` (`test/scripts/next-sd-tools.test.ts` pins them)
 */
function defaultNextModel() {
  const source = readFileSync(join(REPO_ROOT, "src/emu/machines/zxNext/nextProfiles.ts"), "utf8");
  const id = /NEW_PROJECT_NEXT_PROFILE_ID\s*:\s*NextProfileId\s*=\s*"([^"]+)"/.exec(source)?.[1];
  const block = id && new RegExp(`"${id}":\\s*\\{([^}]*)\\}`).exec(source)?.[1];
  const field = (name) => block && new RegExp(`${name}:\\s*"([^"]+)"`).exec(block)?.[1];
  const workingCopy = field("sdWorkingCopy");
  const romSet = field("romSet");
  if (!id || !workingCopy || !romSet) throw new Error("Cannot read the default Next model from nextProfiles.ts");
  return { id, workingCopy, romSet };
}

/**
 * The card a developer tool gives a run of the IDE on the default Next model: `override` (a card the
 * developer names), else the fetched base card, else undefined (`npm run next-sd:fetch` makes it)
 */
function defaultNextCard(override) {
  if (override) return existsSync(override) ? override : undefined;
  const { romSet } = defaultNextModel();
  const card = cardOf(romSet);
  const file = localBase(romSet);
  return existsSync(file) && statSync(file).size === card.size ? file : undefined;
}

module.exports = {
  defaultNextCard,
  defaultNextModel,
  DEFAULT_BASE_URL,
  LOCAL,
  MANIFEST,
  MAX_PUBLISHED_CARDS,
  PUBLISHED_FOLDER,
  baseUrl,
  cardOf,
  cardSets,
  downloadGz,
  fileFacts,
  get,
  gunzipCard,
  gzName,
  gzipCard,
  isPublishedGz,
  isRawCard,
  localBase,
  localGz,
  publishedUrl,
  readManifest
};

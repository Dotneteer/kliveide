#!/usr/bin/env node
/*
 * Stages the ZX Spectrum Next SD card(s) the installer carries (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phase 2): `package.json`'s `extraResources` entry from `.local/next-sd-stage` names them
 * (`<setId>.cim.gz`, the default model's set only, D-2), and electron-builder copies them into
 * `<resources>/next-sd/`. Run by `npm run build:app`, so every packaging path stages them first.
 *
 *   node dev/scripts/stage-next-sd.cjs
 *
 * For each card, the first that fits is staged:
 * 1. the staged file itself, when it is the manifest's gzipped card (`gzSha256`) - nothing to do;
 * 2. `.local/next-sd/<setId>.cim.gz`, the published card (`next-sd:fetch`, phase 3), when it is the
 *    manifest's;
 * 3. the raw card in the repository (`sdBaseImage.file`), gzipped here at level 9. Gzip output may differ
 *    between zlib versions, so its hash need not be `gzSha256`: the installer's card is accepted by its
 *    raw bytes, which are checked here and again whenever Klive makes a working copy from it.
 */
const { createHash } = require("node:crypto");
const { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");
const { createGzip } = require("node:zlib");
const { REPO_ROOT } = require("./repo-root.cjs");

const STAGE = ".local/next-sd-stage";
const FETCHED = join(REPO_ROOT, ".local/next-sd");

function sha256(file) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolvePromise(hash.digest("hex")));
  });
}

/** The cards `package.json` puts into the installer: `[{ setId, card, file }]` */
function stagedCards() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "src/common/zxnext/nextRomSets.json"), "utf8"));
  const entry = (pkg.build?.extraResources ?? []).find((e) => e.from === STAGE);
  if (!entry?.filter?.length) throw new Error(`package.json has no extraResources entry from ${STAGE}`);
  return entry.filter.map((name) => {
    const setId = name.replace(/\.cim\.gz$/, "");
    const card = manifest[setId]?.sdBaseImage;
    if (!card) throw new Error(`${name}: no ROM set '${setId}' with an sdBaseImage in nextRomSets.json`);
    return { setId, card, name, file: join(REPO_ROOT, STAGE, name) };
  });
}

async function gzipRaw(setId, card, target) {
  const raw = join(REPO_ROOT, "src/public", card.file);
  if (!existsSync(raw)) {
    throw new Error(`${setId}: neither ${join(FETCHED, `${setId}.cim.gz`)} nor ${raw} is here to stage`);
  }
  const hash = createHash("sha256");
  let size = 0;
  const measure = new Transform({
    transform(chunk, _encoding, done) {
      hash.update(chunk);
      size += chunk.length;
      done(null, chunk);
    }
  });
  const partial = `${target}.partial`;
  try {
    await pipeline(createReadStream(raw), measure, createGzip({ level: 9 }), createWriteStream(partial));
    const digest = hash.digest("hex");
    if (digest !== card.sha256 || size !== card.size) {
      throw new Error(`${raw}: ${size} bytes, sha256 ${digest}; the manifest pins ${card.size} bytes, ${card.sha256}`);
    }
    renameSync(partial, target);
  } finally {
    rmSync(partial, { force: true });
  }
}

async function main() {
  mkdirSync(join(REPO_ROOT, STAGE), { recursive: true });
  for (const { setId, card, name, file } of stagedCards()) {
    if (existsSync(file) && (await sha256(file)) === card.gzSha256) {
      console.log(`${name}: already staged`);
      continue;
    }
    const fetched = join(FETCHED, name);
    if (existsSync(fetched) && (await sha256(fetched)) === card.gzSha256) {
      copyFileSync(fetched, file);
      console.log(`${name}: staged from ${fetched}`);
      continue;
    }
    rmSync(file, { force: true });
    await gzipRaw(setId, card, file);
    const matches = (await sha256(file)) === card.gzSha256;
    console.log(
      `${name}: gzipped from the repository's card${matches ? "" : " (not byte-identical to the published .gz; the raw card is the manifest's)"}`
    );
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

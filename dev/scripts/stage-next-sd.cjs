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
 * 2. `.local/next-sd/<setId>.cim.gz`, the published card (`next-sd:fetch`), when it is the manifest's;
 * 3. the raw card (`.local/next-sd/<setId>-base.cim`), gzipped here at level 9: the path of a card
 *    that is built but not published yet (a new default model). Gzip output may differ
 *    between zlib versions, so its hash need not be `gzSha256`: the installer's card is accepted by its
 *    raw bytes, which are checked here and again whenever Klive makes a working copy from it.
 */
const { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { REPO_ROOT } = require("./repo-root.cjs");
const cards = require("./next-sd/cards.cjs");

const STAGE = ".local/next-sd-stage";

/** The cards `package.json` puts into the installer: `[{ setId, card, name, file }]` */
function stagedCards() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  const entry = (pkg.build?.extraResources ?? []).find((e) => e.from === STAGE);
  if (!entry?.filter?.length) throw new Error(`package.json has no extraResources entry from ${STAGE}`);
  const manifest = cards.readManifest();
  return entry.filter.map((name) => {
    const setId = name.replace(/\.cim\.gz$/, "");
    return { setId, card: cards.cardOf(setId, manifest), name, file: join(REPO_ROOT, STAGE, name) };
  });
}

/** Gzips the raw card (fetched or built), checked against the manifest first */
async function gzipRaw(setId, card, target) {
  const raw = cards.localBase(setId);
  if (!existsSync(raw)) throw new Error(`${setId}: no card to stage; run npm run next-sd:fetch -- ${setId}`);
  if (!(await cards.isRawCard(raw, card))) {
    throw new Error(`${raw} is not the manifest's card (${card.size} bytes, sha256 ${card.sha256})`);
  }
  await cards.gzipCard(raw, target);
}

async function main() {
  mkdirSync(join(REPO_ROOT, STAGE), { recursive: true });
  for (const { setId, card, name, file } of stagedCards()) {
    if (await cards.isPublishedGz(file, card)) {
      console.log(`${name}: already staged`);
      continue;
    }
    const fetched = cards.localGz(setId);
    if (await cards.isPublishedGz(fetched, card)) {
      copyFileSync(fetched, file);
      console.log(`${name}: staged from ${fetched}`);
      continue;
    }
    rmSync(file, { force: true });
    await gzipRaw(setId, card, file);
    const matches = await cards.isPublishedGz(file, card);
    console.log(
      `${name}: gzipped from ${cards.localBase(setId)}${matches ? "" : " (not byte-identical to the published .gz; the raw card is the manifest's)"}`
    );
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

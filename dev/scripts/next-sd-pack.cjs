#!/usr/bin/env node
/*
 * Packs a ZX Spectrum Next SD base card for publishing (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 3):
 * gzips the raw card at level 9 into `.local/next-sd/<setId>.cim.gz` and records `gzSize` and
 * `gzSha256` in the set's `sdBaseImage` (`src/common/zxnext/nextRomSets.json`).
 *
 *   npm run next-sd:pack -- <setId>
 *
 * The raw card is `.local/next-sd/<setId>-base.cim` (written by `next-sd:build` or `next-sd:fetch`), or
 * the card still committed in `src/public`; it must have the manifest's size and sha256.
 *
 * **A published card is never re-packed** (D-6): gzip output can change with the zlib version, and the
 * published `.gz` is what `gzSha256` names. The script refuses a set whose card is on the site
 * (`KLIVE_NEXT_SD_BASE_URL` overrides it), and a set it cannot check while offline.
 */
const { existsSync, writeFileSync } = require("node:fs");
const cards = require("./next-sd/cards.cjs");

async function isPublished(setId) {
  const { status, response } = await cards.get(cards.publishedUrl(setId), "HEAD");
  response.resume();
  if (status === 200) return true;
  if (status === 404) return false;
  throw new Error(`${cards.publishedUrl(setId)}: HTTP ${status}, cannot tell whether the card is published`);
}

async function main() {
  const setId = process.argv[2];
  if (!setId || setId.startsWith("-")) {
    console.error("Usage: npm run next-sd:pack -- <setId>");
    process.exit(2);
  }
  const manifest = cards.readManifest();
  const card = cards.cardOf(setId, manifest);
  if (await isPublished(setId)) {
    throw new Error(`${setId} is published at ${cards.publishedUrl(setId)}: a published card is never re-packed (D-6)`);
  }
  const raw = [cards.localBase(setId), cards.repositoryBase(card)].find((file) => existsSync(file));
  if (!raw) throw new Error(`${setId}: no raw card; run npm run next-sd:build -- ${setId} first`);
  if (!(await cards.isRawCard(raw, card))) {
    throw new Error(`${raw} is not the manifest's card (${card.size} bytes, sha256 ${card.sha256})`);
  }
  const gz = cards.localGz(setId);
  const facts = await cards.gzipCard(raw, gz);
  manifest[setId].sdBaseImage = { ...card, gzSize: facts.size, gzSha256: facts.sha256 };
  writeFileSync(cards.MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Packed ${raw} into ${gz}: ${facts.size} bytes, sha256 ${facts.sha256}`);
  console.log(`Recorded gzSize and gzSha256 in ${cards.MANIFEST}. Publish it with npm run next-sd:publish -- ${setId}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

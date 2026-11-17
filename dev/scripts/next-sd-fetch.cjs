#!/usr/bin/env node
/*
 * Fetches the ZX Spectrum Next SD base cards for tests and tools (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phase 3, D-6): every set's card, or the sets named.
 *
 *   npm run next-sd:fetch [-- <setId> ...]
 *
 * For each set it ends with `.local/next-sd/<setId>-base.cim`, the raw card with the manifest's size and
 * sha256, and `.local/next-sd/<setId>.cim.gz`, the published bytes (`gzSize`, `gzSha256`):
 * 1. a raw card that is already the manifest's is kept;
 * 2. else a local `.cim.gz` that is the manifest's is decompressed;
 * 3. else the published card is downloaded from kliveide.net (`KLIVE_NEXT_SD_BASE_URL` overrides the
 *    server) and decompressed;
 * 4. else, while the repository still commits the cards (`src/public/mmc`, until step 5 of phase 3),
 *    the committed raw card is copied. A set that is not published yet is fetched this way.
 * Nothing is accepted without both hashes the manifest pins; a failed fetch leaves no file behind.
 */
const { existsSync } = require("node:fs");
const cards = require("./next-sd/cards.cjs");

async function fetchSet(setId, card) {
  const base = cards.localBase(setId);
  const gz = cards.localGz(setId);
  if (await cards.isRawCard(base, card)) return "up to date";
  if (await cards.isPublishedGz(gz, card)) {
    await cards.gunzipCard(gz, base, card);
    return `decompressed ${gz}`;
  }
  let downloadError;
  try {
    const url = await cards.downloadGz(setId, gz, card);
    await cards.gunzipCard(gz, base, card);
    return `downloaded ${url}`;
  } catch (err) {
    downloadError = err;
  }
  const committed = cards.repositoryBase(card);
  if (existsSync(committed)) {
    await cards.copyRawCard(committed, base, card);
    return `copied ${committed} (download failed: ${downloadError.message})`;
  }
  throw downloadError;
}

async function main() {
  const manifest = cards.readManifest();
  const all = cards.cardSets(manifest);
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  for (const setId of wanted) cards.cardOf(setId, manifest);
  let failed = false;
  for (const { setId, card } of all.filter((s) => !wanted.length || wanted.includes(s.setId))) {
    try {
      console.log(`${setId}: ${await fetchSet(setId, card)}`);
    } catch (err) {
      console.error(`${setId}: ${err.message}`);
      failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

#!/usr/bin/env node
/*
 * Checks the ZX Spectrum Next SD cards on kliveide.net (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 3):
 * downloads every set's published card (or the sets named) and checks its `gzSize` and `gzSha256`, then
 * that it decompresses to the raw card's `size` and `sha256`. By hand and in the release dry run, never
 * in push CI (it downloads ~120 MB).
 *
 *   npm run next-sd:check-site [-- <setId> ...]
 *
 * `KLIVE_NEXT_SD_BASE_URL` checks another server. The downloads go to a temporary folder.
 */
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const cards = require("./next-sd/cards.cjs");

async function main() {
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const sets = cards.cardSets().filter((s) => !wanted.length || wanted.includes(s.setId));
  const temp = mkdtempSync(join(tmpdir(), "klive-next-sd-site-"));
  let failed = false;
  try {
    for (const { setId, card } of sets) {
      const gz = join(temp, cards.gzName(setId));
      try {
        const url = await cards.downloadGz(setId, gz, card);
        await cards.gunzipCard(gz, join(temp, `${setId}.cim`), card);
        console.log(`${setId}: ${url} is the manifest's card (${card.gzSize} bytes gzipped, ${card.size} raw)`);
      } catch (err) {
        console.error(`${setId}: ${err.message}`);
        failed = true;
      } finally {
        rmSync(join(temp, `${setId}.cim`), { force: true });
        rmSync(gz, { force: true });
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

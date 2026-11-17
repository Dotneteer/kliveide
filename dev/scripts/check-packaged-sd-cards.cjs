#!/usr/bin/env node
/*
 * Checks that a packaged Klive carries the ZX Spectrum Next SD card(s) it should
 * (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phases 0 and 2).
 *
 *   node dev/scripts/check-packaged-sd-cards.cjs <resources folder of the packaged app>
 *
 * Every card `package.json` puts into the kit (its `extraResources` entry from `.local/next-sd-stage`,
 * staged by `dev/scripts/stage-next-sd.cjs`) must be in `<resources>/next-sd/` as `<setId>.cim.gz`, and
 * decompress to the raw card its ROM set's manifest entry pins (`sdBaseImage.size` and `.sha256` in
 * `src/common/zxnext/nextRomSets.json`). `test/scripts/packaged-sd-cards.test.ts` checks that this list
 * holds the default model's card; this script checks that the build really copied it. No release up
 * to v0.68.1 shipped a card, and the Next booted to "Drive C: not found".
 */
const { createHash } = require("node:crypto");
const { createReadStream, existsSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");
const { createGunzip } = require("node:zlib");
const { REPO_ROOT } = require("./repo-root.cjs");

const STAGE = ".local/next-sd-stage";

/** The raw card's size and sha256, decompressing on the way */
function rawFacts(file) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    let size = 0;
    createReadStream(file)
      .on("error", reject)
      .pipe(createGunzip())
      .on("data", (chunk) => {
        hash.update(chunk);
        size += chunk.length;
      })
      .on("error", reject)
      .on("end", () => resolvePromise({ size, sha256: hash.digest("hex") }));
  });
}

async function main() {
  const resources = process.argv[2];
  if (!resources || !existsSync(resources)) {
    console.error("Usage: node dev/scripts/check-packaged-sd-cards.cjs <resources folder of the packaged app>");
    process.exit(2);
  }
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "src/common/zxnext/nextRomSets.json"), "utf8"));
  const entry = (pkg.build?.extraResources ?? []).find((e) => e.from === STAGE);
  const cards = entry?.filter ?? [];
  if (!cards.length) {
    console.error(`package.json ships no ZX Spectrum Next SD card (no extraResources entry from ${STAGE})`);
    process.exit(1);
  }
  let failed = false;
  for (const name of cards) {
    const setId = name.replace(/\.cim\.gz$/, "");
    const card = manifest[setId]?.sdBaseImage;
    const file = join(resources, entry.to, name);
    if (!card) {
      console.error(`${name}: no ROM set '${setId}' with an sdBaseImage in nextRomSets.json`);
      failed = true;
    } else if (!existsSync(file)) {
      console.error(`${name}: missing from the packaged app (${file})`);
      failed = true;
    } else {
      const actual = await rawFacts(file).catch((err) => ({ error: err.message }));
      if (actual.error || actual.sha256 !== card.sha256 || actual.size !== card.size) {
        console.error(
          `${name}: ${actual.error ?? `decompresses to ${actual.size} bytes, sha256 ${actual.sha256}`}; ` +
            `the ${setId} manifest pins ${card.size} bytes, ${card.sha256}`
        );
        failed = true;
      } else {
        console.log(`${name}: present (${statSync(file).size} bytes gzipped), the ${setId} card`);
      }
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

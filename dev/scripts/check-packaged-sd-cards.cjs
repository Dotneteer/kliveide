#!/usr/bin/env node
/*
 * Checks that a packaged Klive carries the ZX Spectrum Next SD card(s) it should
 * (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 0).
 *
 *   node dev/scripts/check-packaged-sd-cards.cjs <resources folder of the packaged app>
 *
 * Every card `package.json` puts into the kit (its `extraResources` entry from `src/public/mmc`) must be
 * in `<resources>/mmc/`, byte for byte the base image its ROM set's manifest entry pins
 * (`sdBaseImage.sha256` in `src/common/zxnext/nextRomSets.json`). `test/build/packaging.test.ts` checks
 * that this list holds the default model's card; this script checks that the build really copied it.
 * No release before this check shipped a card, and the Next booted to "Drive C: not found".
 */
const { createHash } = require("node:crypto");
const { createReadStream, existsSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");
const { REPO_ROOT } = require("./repo-root.cjs");

function sha256(file) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolvePromise(hash.digest("hex")));
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
  const entry = (pkg.build?.extraResources ?? []).find((e) => e.from === "src/public/mmc");
  const cards = entry?.filter ?? [];
  if (!cards.length) {
    console.error("package.json ships no ZX Spectrum Next SD card (no extraResources entry from src/public/mmc)");
    process.exit(1);
  }
  let failed = false;
  for (const name of cards) {
    const set = Object.entries(manifest).find(([, s]) => s.sdBaseImage?.file === `mmc/${name}`);
    const file = join(resources, entry.to, name);
    if (!set) {
      console.error(`${name}: no ROM set in nextRomSets.json names it as its SD base image`);
      failed = true;
    } else if (!existsSync(file)) {
      console.error(`${name}: missing from the packaged app (${file})`);
      failed = true;
    } else {
      const actual = await sha256(file);
      if (actual !== set[1].sdBaseImage.sha256) {
        console.error(`${name}: sha256 ${actual}, the ${set[0]} manifest pins ${set[1].sdBaseImage.sha256}`);
        failed = true;
      } else {
        console.log(`${name}: present (${statSync(file).size} bytes), the ${set[0]} card`);
      }
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

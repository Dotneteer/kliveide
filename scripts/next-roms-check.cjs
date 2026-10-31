#!/usr/bin/env node
/*
 * Checks the committed ZX Spectrum Next ROM sets against the manifest
 * (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D9.3).
 *
 *   npm run next-roms:check              the committed files: present, size, sha256, page CRCs
 *   npm run next-roms:check -- --online  also re-downloads each file at its recorded commit and
 *                                         confirms it is the committed bytes (by hand, never in CI)
 *
 * The offline half is also a unit test (`test/zxnext/romSets.test.ts`).
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { describe, download, MANIFEST, ROM_ROOT } = require("./next-roms-fetch.cjs");

async function main() {
  const online = process.argv.includes("--online");
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  let failures = 0;
  for (const [setId, set] of Object.entries(manifest)) {
    for (const [file, expected] of Object.entries(set.files)) {
      const bytes = new Uint8Array(readFileSync(join(ROM_ROOT, setId, file)));
      const actual = describe(bytes);
      const ok = actual.size === expected.size && actual.sha256 === expected.sha256 && actual.pages.join() === expected.pages.join();
      let line = `${setId}/${file}: ${ok ? "ok" : "MISMATCH"}`;
      if (!ok) failures++;
      if (online) {
        const remote = await download(set.source.commit, file);
        const same = Buffer.compare(Buffer.from(remote), Buffer.from(bytes)) === 0;
        if (!same) failures++;
        line += `, upstream ${same ? "same bytes" : "DIFFERENT BYTES"}`;
      }
      console.log(line);
    }
  }
  if (failures) {
    console.error(`${failures} problem(s).`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

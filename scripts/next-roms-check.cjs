#!/usr/bin/env node
/*
 * Checks the committed ZX Spectrum Next ROM sets against the manifest
 * (`dev/ai/zxnext-models.md` D9.3).
 *
 *   npm run next-roms:check              the committed files: present, size, sha256, page CRCs; the
 *                                         FPGA ROMs (`fpgaRoms`): size, sha256, page CRCs, and, when
 *                                         `dev/vendor/next-fpga/<core>/` is fetched, the bytes of its VHDL table
 *   npm run next-roms:check -- --online  also re-downloads each file at its recorded commit and
 *                                         confirms it is the committed bytes (by hand, never in CI)
 *
 * The offline half is also a unit test (`test/zxnext/romSets.test.ts`).
 */
const { existsSync, readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join } = require("node:path");
const { describe, download, MANIFEST, ROM_ROOT } = require("./next-roms-fetch.cjs");
const { REPO_ROOT } = require("./repo-root.cjs");

const VENDOR = join(REPO_ROOT, "dev/vendor/next-fpga");

/** The bytes of a `romgen` VHDL table: rows of eight `x"NN"` values, each ending in `-- 0xADDR` */
function romFromVhdl(text) {
  const rows = [...text.matchAll(/((?:x"[0-9A-Fa-f]{2}",?\s*){8})--\s*0x([0-9A-Fa-f]+)/g)];
  const bytes = [];
  rows.forEach(([, row, address], index) => {
    if (Number.parseInt(address, 16) !== index * 8) throw new Error(`row ${index} is at 0x${address}, not in address order`);
    for (const [, value] of row.matchAll(/x"([0-9A-Fa-f]{2})"/g)) bytes.push(Number.parseInt(value, 16));
  });
  return Uint8Array.from(bytes);
}

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
  for (const [setId, set] of Object.entries(manifest)) {
    for (const [file, expected] of Object.entries(set.fpgaRoms ?? {})) {
      const bytes = readFileSync(join(ROM_ROOT, setId, file));
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const pages = describe(new Uint8Array(bytes)).pages;
      let ok = bytes.length === expected.size && sha256 === expected.sha256 && pages.join() === (expected.pages ?? []).join();
      let line = `${setId}/${file}: ${ok ? "ok" : "MISMATCH"}`;
      const vhdl = join(VENDOR, expected.core, expected.source);
      if (existsSync(vhdl)) {
        const same = Buffer.compare(Buffer.from(romFromVhdl(readFileSync(vhdl, "utf8"))), bytes) === 0;
        if (!same) ok = false;
        line += `, core ${expected.core} ${same ? "same bytes" : "DIFFERENT BYTES"}`;
      } else {
        line += `, core ${expected.core} not fetched (npm run next-fpga:fetch)`;
      }
      if (!ok) failures++;
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

/*
 * Resolves a file of a fetched ZX Spectrum Next VHDL tree (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md`
 * D4): `nextFpgaPath("3.02.01", "src/zxnext.vhd")` -> `vendor/next-fpga/3.02.01/src/zxnext.vhd`.
 * Paths are relative to upstream's `cores/zxnext/`. Throws, naming the command to run, when the
 * tree or the file is not there. No dependencies, so tests and scripts can import it cheaply.
 */
const fs = require("node:fs");
const path = require("node:path");

const NEXT_FPGA_ROOT = path.join(__dirname, "..", "vendor", "next-fpga");

function nextFpgaPath(version, file) {
  const dir = path.join(NEXT_FPGA_ROOT, version);
  const full = path.join(dir, file);
  if (!fs.existsSync(path.join(dir, ".klive-source"))) {
    throw new Error(`The ZX Spectrum Next VHDL ${version} is not fetched: run \`npm run next-fpga:fetch\``);
  }
  if (!fs.existsSync(full)) {
    throw new Error(
      `${file} is not in the fetched ZX Spectrum Next VHDL ${version} (${full}): run \`npm run next-fpga:fetch\``
    );
  }
  return full;
}

/** Whether `version`'s fetched tree has Klive's comment patches applied (any at all). */
function nextFpgaIsCommented(version) {
  const stamp = path.join(NEXT_FPGA_ROOT, version, ".klive-comments");
  if (!fs.existsSync(stamp)) return false;
  return Object.keys(JSON.parse(fs.readFileSync(stamp, "utf8")).patches ?? {}).length > 0;
}

module.exports = { NEXT_FPGA_ROOT, nextFpgaPath, nextFpgaIsCommented };

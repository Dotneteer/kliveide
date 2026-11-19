// Writes the sample screen files of samples.js to samples/, for the manual tests of
// dev/plans/SCREEN_FILE_VIEWERS_PLAN.md:
//   node dev/plans/screen-file-viewers/generate-samples.cjs
// The files are generated, so they are reproducible; the README beside them says what each one is
// for and what a viewer should show.
const fs = require("fs");
const path = require("path");
const screenSamples = require("./samples.js");

const REPO = path.join(__dirname, "..", "..", "..");
const font = fs.readFileSync(path.join(REPO, "src", "public", "roms", "sp48.rom")).subarray(0x3d00, 0x3d00 + 768);
const out = path.join(__dirname, "samples");
fs.mkdirSync(out, { recursive: true });

const { files } = screenSamples(font);
for (const f of files) {
  fs.writeFileSync(path.join(out, f.name), f.bytes);
  console.log(`${f.name.padEnd(22)} ${String(f.bytes.length).padStart(6)} bytes`);
}
